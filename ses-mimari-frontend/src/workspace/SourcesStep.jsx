import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  ArrowLeft,
  Check,
  Copy,
  FileAudio,
  FileText,
  Headphones,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  Radio,
  Send,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';

import {
  readSessionUnified,
  syncLiveAnalysisContext,
  buildAnalysisContextFromUnified,
  sortWorkspaceFilesDeterministic,
  roomCodeFromProjectId,
  normalizeQuickRoomCode,
  SOCKET_URL,
  apiProjectTranscriptsUrl,
  apiProjectChatLogsUrl,
  postWorkspaceResource,
  postProjectMediaUpload,
  formatTrTime,
} from './constants';
import { getGuestLiveSocket } from './guestSocketSingleton';
import './sources-workspace.css';

/** participants-sync yükünü her zaman güvenli bir diziye çevirir */
function normalizeParticipantsList(raw) {
  if (Array.isArray(raw)) return raw.map((item) => (item && typeof item === 'object' ? { ...item } : item));
  if (raw == null) return [];
  if (typeof raw === 'object') return Array.from(Object.values(raw)).filter((x) => x != null);
  return [];
}

/** Sohbet başlığı / analiz satırı için görünen yazar adı */
function chatAuthorForContext(m, viewerDisplayName, isGuest) {
  const d = String(m?.senderDisplayName ?? '').trim();
  if (d) return d;
  const l = String(m?.senderLabel ?? '').trim();
  if (l === 'Siz' && !isGuest) return String(viewerDisplayName || '').trim() || 'Ev sahibi';
  if (l) return l;
  return 'Katılımcı';
}

/** Bu istemcide gönderilen mesaj mı (sağ hizalama); eski kayıtlar senderClientKey olmadan gelir */
function messageIsOwnForViewer(m, isGuest, myClientKey) {
  const key = String(m?.senderClientKey ?? '').trim();
  const mine = String(myClientKey ?? '').trim();
  if (key && mine) return key === mine;
  if (isGuest) return false;
  const lab = String(m?.senderLabel ?? '').trim();
  return lab === 'Siz' || !lab;
}

/** Eski `transcriptLines: string[]` (STT + "Siz:" karışık) → yapılandırılmış kayıtlar */
function migrateLegacyTranscriptLines(lines) {
  const stt = [];
  const chat = [];
  for (const line of lines || []) {
    const s = String(line || '');
    if (!s.trim()) continue;
    if (/\bSiz:\s*/i.test(s)) {
      const text = s.replace(/^.*?\]\s*Siz:\s*/i, '').replace(/^.*Siz:\s*/i, '').trim();
      if (text) chat.push({ id: crypto.randomUUID(), text, sentAt: Date.now(), senderLabel: 'Siz', senderClientKey: 'host' });
    } else {
      const text = s.replace(/^\[[^\]]+\]\s*/, '').trim();
      if (text) stt.push({ id: crypto.randomUUID(), text, capturedAt: Date.now() });
    }
  }
  return { stt, chat };
}

const MAX_TEXT_BYTES = 480 * 1024;
const VOICE_BAR_COUNT = 7;

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ''));
    r.onerror = () => reject(r.error);
    r.readAsText(file, 'UTF-8');
  });
}

function isAudioFile(file) {
  return file.type.startsWith('audio') || /\.(mp3|wav|m4a|webm|ogg)$/i.test(file.name);
}

function isTextFile(file) {
  return file.type.startsWith('text/') || /\.(txt|md|csv|json|log|tsv)$/i.test(file.name);
}

async function fileToEntry(file, blobStore) {
  const id = crypto.randomUUID();
  const base = {
    id,
    name: file.name,
    size: file.size,
    type: file.type || 'application/octet-stream',
    addedAt: new Date().toISOString(),
  };

  if (isTextFile(file) && file.size <= MAX_TEXT_BYTES) {
    try {
      const textContent = await readTextFile(file);
      return { ...base, kind: 'text', textContent };
    } catch {
      return { ...base, kind: 'text' };
    }
  }

  if (isAudioFile(file)) {
    const url = URL.createObjectURL(file);
    blobStore.set(id, { url, file });
    return { ...base, kind: 'audio' };
  }

  return { ...base, kind: 'other' };
}

function canPreview(f, blobStore) {
  if (typeof f.textContent === 'string' && f.textContent.length > 0) return true;
  const audio =
    f.kind === 'audio' ||
    (!f.kind && (String(f.type || '').startsWith('audio') || /\.(mp3|wav|m4a|webm|ogg)$/i.test(f.name || '')));
  if (audio && blobStore.has(f.id)) return true;
  return false;
}

export default function SourcesStep({
  project,
  viewerDisplayName = 'Kullanıcı',
  onBack,
  onContinue,
  onPatch,
  onPersistBeforeDiagram,
  guestSocket = null,
  guestSocketRef = null,
}) {
  const inputRef = useRef(null);
  const blobMapRef = useRef(new Map());
  const chatScrollRef = useRef(null);
  /** Ev sahibi: mikrofon + Web Audio seviye çubukları + tarayıcı STT (canlı oda soketi ayrı ve mount’ta otomatik) */
  const [roomConnected, setRoomConnected] = useState(false);
  /** Sunucudan gelen odadaki gerçek bağlantılar (host + misafir socket'leri) */
  const [socketParticipants, setSocketParticipants] = useState([]);
  const [copyRoom, setCopyRoom] = useState('idle');
  const [previewId, setPreviewId] = useState(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [handoffBusy, setHandoffBusy] = useState(false);
  const [sttTranscripts, setSttTranscripts] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatDraft, setChatDraft] = useState('');
  const speechRecRef = useRef(null);
  const hostSocketRef = useRef(null);
  const sttRef = useRef([]);
  const chatRef = useRef([]);

  const [micActive, setMicActive] = useState(false);
  const [micBusy, setMicBusy] = useState(false);
  const [micError, setMicError] = useState('');
  const micStreamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const freqDataRef = useRef(null);
  const rafLoopRef = useRef(null);
  const barElRefs = useRef([]);

  const files = useMemo(() => project.files ?? [], [project.files]);
  const isGuest = project.isGuest === true;

  const myChatClientKey = useMemo(() => {
    if (!isGuest) return 'host';
    return String(
      (guestSocket ?? guestSocketRef?.current ?? getGuestLiveSocket())?.id || '',
    ).trim();
  }, [isGuest, guestSocket, guestSocketRef]);

  const speechSupported = useMemo(
    () => typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition),
    [],
  );

  const sttDisplayLines = useMemo(
    () =>
      sttTranscripts
        .map((t) => {
          const text = String(t?.text ?? '').trim();
          if (!text) return '';
          const ts = formatTrTime(t?.capturedAt);
          return ts ? `[${ts}] ${text}` : text;
        })
        .filter(Boolean),
    [sttTranscripts],
  );

  const chatBlockForAnalysis = useMemo(
    () =>
      chatMessages
        .map((m) => {
          const text = String(m?.text ?? '').trim();
          if (!text) return '';
          const ts = formatTrTime(m?.sentAt);
          const who = chatAuthorForContext(m, viewerDisplayName, isGuest);
          return ts ? `[${ts}] ${who}: ${text}` : `${who}: ${text}`;
        })
        .join('\n'),
    [chatMessages, viewerDisplayName, isGuest],
  );

  const analysisContextReady = useMemo(() => {
    const sorted = sortWorkspaceFilesDeterministic(files);
    return (
      buildAnalysisContextFromUnified({
        files: sorted,
        transcriptLines: sttDisplayLines,
        notes: String(project.sourcesNotes ?? ''),
        messages: chatBlockForAnalysis,
      }).length > 0
    );
  }, [files, sttDisplayLines, chatBlockForAnalysis, project.sourcesNotes]);

  const handleDiagramHandoff = useCallback(async () => {
    if (isGuest) return;
    setHandoffBusy(true);
    try {
      syncLiveAnalysisContext(project, { sttTranscripts, chatMessages });
      await onPersistBeforeDiagram?.(project);
      onContinue?.();
    } finally {
      setHandoffBusy(false);
    }
  }, [project, sttTranscripts, chatMessages, onPersistBeforeDiagram, onContinue, isGuest]);

  useEffect(() => {
    if (isGuest) {
      const chatS = Array.isArray(project.guestChatMessagesSeed) ? [...project.guestChatMessagesSeed] : [];
      const sttS = Array.isArray(project.guestTranscriptSeed) ? [...project.guestTranscriptSeed] : [];
      const legacy = Array.isArray(project.guestLegacyTranscriptLines) ? project.guestLegacyTranscriptLines : [];
      if (!chatS.length && !sttS.length && legacy.length) {
        const { stt, chat } = migrateLegacyTranscriptLines(legacy);
        setSttTranscripts(stt);
        setChatMessages(chat);
      } else {
        setSttTranscripts(sttS);
        setChatMessages(chatS);
      }
      return;
    }
    const u = readSessionUnified(project.id);
    const chatS = Array.isArray(u?.chatMessages) ? u.chatMessages : [];
    const sttS = Array.isArray(u?.sttTranscripts) ? u.sttTranscripts : [];
    const legacy =
      !chatS.length && !sttS.length && Array.isArray(u?.transcriptLines) ? u.transcriptLines : [];
    if (legacy.length) {
      const { stt, chat } = migrateLegacyTranscriptLines(legacy);
      setSttTranscripts(stt);
      setChatMessages(chat);
    } else {
      setSttTranscripts(sttS);
      setChatMessages(chatS);
    }
  }, [
    project.id,
    isGuest,
    project.guestChatMessagesSeed,
    project.guestTranscriptSeed,
    project.guestLegacyTranscriptLines,
  ]);

  useEffect(() => {
    if (!isGuest) return undefined;
    const sock = guestSocket ?? guestSocketRef?.current ?? getGuestLiveSocket();
    if (!sock) return undefined;
    const onSync = (payload) => {
      if (Array.isArray(payload?.files)) onPatch({ files: payload.files });

      const seg = Array.isArray(payload?.transcriptSegments) ? payload.transcriptSegments : null;
      const msgs = Array.isArray(payload?.chatMessages) ? payload.chatMessages : null;
      const lines = Array.isArray(payload?.chatLines) ? payload.chatLines : null;

      if (seg) setSttTranscripts([...seg]);
      if (msgs) setChatMessages([...msgs]);
      if (!seg && !msgs && lines) {
        const { stt, chat } = migrateLegacyTranscriptLines(lines);
        setSttTranscripts(stt);
        setChatMessages(chat);
      }
    };
    sock.on('room-sync', onSync);
    return () => {
      sock.off('room-sync', onSync);
    };
  }, [isGuest, guestSocket, guestSocketRef, onPatch]);

  const projectRef = useRef(project);
  const filesRef = useRef(files);
  const viewerDisplayNameRef = useRef(viewerDisplayName);
  useEffect(() => {
    projectRef.current = project;
  }, [project]);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);
  useEffect(() => {
    viewerDisplayNameRef.current = viewerDisplayName;
  }, [viewerDisplayName]);
  useEffect(() => {
    sttRef.current = sttTranscripts;
  }, [sttTranscripts]);
  useEffect(() => {
    chatRef.current = chatMessages;
  }, [chatMessages]);

  useEffect(() => {
    if (isGuest) return undefined;
    const canonicalRoom = normalizeQuickRoomCode(roomCodeFromProjectId(project.id));
    const currentRoomCode = canonicalRoom;

    const s = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
    });
    s.__roomCode = canonicalRoom;

    const onParticipants = (data) => {
      const incoming = normalizeQuickRoomCode(String(data?.roomCode ?? data?.roomId ?? '').trim());
      const expected = normalizeQuickRoomCode(String(currentRoomCode).trim());
      // eslint-disable-next-line no-console
      console.log('GELEN SOKET VERİSİ:', data?.roomId ?? data?.roomCode, 'BEKLENEN ODA:', currentRoomCode, 'LİSTE:', data?.participants);
      if (incoming !== expected) return;
      setSocketParticipants(() => normalizeParticipantsList(data?.participants));
    };

    const slimFiles = (list) =>
      (list || []).map((f) => ({
        id: f.id,
        name: f.name,
        size: f.size,
        type: f.type,
        kind: f.kind,
        addedAt: f.addedAt,
        textContent: typeof f.textContent === 'string' ? f.textContent : undefined,
      }));

    const publish = () => {
      if (!s.connected) return;
      const p = projectRef.current;
      s.emit('host-publish', {
        roomCode: canonicalRoom,
        projectId: p.id,
        projectName: p.name || 'Proje',
        files: slimFiles(filesRef.current),
        chatMessages: [...(chatRef.current || [])],
        transcriptSegments: [...(sttRef.current || [])],
        chatLines: (chatRef.current || []).map((m) => {
          const ts = formatTrTime(m?.sentAt);
          const text = String(m?.text ?? '').trim();
          const who = chatAuthorForContext(m, viewerDisplayNameRef.current, false);
          return ts ? `[${ts}] ${who}: ${text}` : `${who}: ${text}`;
        }),
      });
    };

    let intervalId = null;
    const onConnect = () => {
      hostSocketRef.current = s;
      // eslint-disable-next-line no-console
      console.log("✅ SOKET BAĞLANDI! BAŞARILI ID:", s.id);
      s.emit('join-room', { roomCode: canonicalRoom, role: 'host', label: 'Siz' });
      publish();
      if (intervalId != null) {
        window.clearInterval(intervalId);
      }
      intervalId = window.setInterval(publish, 2200);
    };

    const onRoomSync = (payload) => {
      const incoming = normalizeQuickRoomCode(String(payload?.roomCode ?? '').trim());
      const expected = normalizeQuickRoomCode(String(currentRoomCode).trim());
      if (incoming !== expected) return;
      if (Array.isArray(payload?.chatMessages)) {
        setChatMessages([...payload.chatMessages]);
      }
      if (Array.isArray(payload?.transcriptSegments)) {
        setSttTranscripts([...payload.transcriptSegments]);
      }
    };

    s.on('participants-sync', onParticipants);
    s.on('room-sync', onRoomSync);
    s.on('connect', onConnect);
    const onConnectError = (err) => {
      // eslint-disable-next-line no-console
      console.error('[SesMimari] HOST socket connect_error:', err?.message || err);
    };
    s.on('connect_error', onConnectError);
    s.io.on('reconnect', onConnect);

    s.connect();

    return () => {
      hostSocketRef.current = null;
      if (intervalId != null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
      s.io.off('reconnect', onConnect);
      s.off('participants-sync', onParticipants);
      s.off('room-sync', onRoomSync);
      s.off('connect', onConnect);
      s.off('connect_error', onConnectError);
      setSocketParticipants([]);
      try {
        s.emit('leave-room-channel', { roomCode: canonicalRoom });
      } catch {
        /* ignore */
      }
      try {
        s.close();
      } catch {
        /* ignore */
      }
    };
  }, [isGuest, project.id]);

  useEffect(() => {
    if (!isGuest) return undefined;
    const sock = guestSocket ?? guestSocketRef?.current ?? getGuestLiveSocket();
    if (!sock) return undefined;
    const rc = normalizeQuickRoomCode(sock.__roomCode || roomCodeFromProjectId(project.id));
    const currentRoomCode = rc;

    const onParticipants = (data) => {
      const incoming = normalizeQuickRoomCode(String(data?.roomCode ?? data?.roomId ?? '').trim());
      const expected = normalizeQuickRoomCode(String(currentRoomCode).trim());
      // eslint-disable-next-line no-console
      console.log('GELEN SOKET VERİSİ:', data?.roomId ?? data?.roomCode, 'BEKLENEN ODA:', currentRoomCode, 'LİSTE:', data?.participants);
      if (incoming !== expected) return;
      setSocketParticipants(() => normalizeParticipantsList(data?.participants));
    };

    // eslint-disable-next-line no-console
    console.log('[SesMimari] GUEST participants-sync dinleyicisi kayıtlı, oda:', rc, 'socket.id:', sock.id, 'connected:', sock.connected);

    sock.on('participants-sync', onParticipants);
    const onGuestIoReconnect = () => {
      const room = normalizeQuickRoomCode(sock.__roomCode || roomCodeFromProjectId(project.id));
      sock.emit('join-room', {
        roomCode: room,
        role: 'guest',
        label: `Misafir (${String(sock.id || '').slice(-4)})`,
      });
    };
    sock.io.on('reconnect', onGuestIoReconnect);

    return () => {
      sock.io.off('reconnect', onGuestIoReconnect);
      sock.off('participants-sync', onParticipants);
      setSocketParticipants([]);
    };
  }, [isGuest, guestSocket, guestSocketRef, project.id]);

  useEffect(() => {
    if (isGuest) return undefined;
    const t = window.setTimeout(() => {
      syncLiveAnalysisContext(project, { sttTranscripts, chatMessages });
    }, 350);
    return () => window.clearTimeout(t);
  }, [project, sttTranscripts, chatMessages, isGuest]);

  const prevRoomRef = useRef(roomConnected);
  useEffect(() => {
    if (isGuest) return;
    if (prevRoomRef.current && !roomConnected) {
      syncLiveAnalysisContext(project, { sttTranscripts, chatMessages });
    }
    prevRoomRef.current = roomConnected;
  }, [roomConnected, project, sttTranscripts, chatMessages, isGuest]);

  useEffect(() => {
    if (!roomConnected || isGuest) {
      if (speechRecRef.current) {
        try {
          speechRecRef.current.stop();
        } catch {
          /* ignore */
        }
        speechRecRef.current = null;
      }
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return undefined;
    const r = new SR();
    r.lang = 'tr-TR';
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const res = event.results[i];
        const text = res[0]?.transcript?.trim();
        if (!text) continue;
        if (res.isFinal) {
          const capturedAt = Date.now();
          const id = crypto.randomUUID();
          const segment = { id, text, capturedAt };
          setSttTranscripts((prev) => [...prev, segment]);
          const room = normalizeQuickRoomCode(roomCodeFromProjectId(projectRef.current.id));
          const sock = hostSocketRef.current;
          if (sock?.connected) {
            sock.emit('save-transcript', {
              roomCode: room,
              projectId: projectRef.current.id,
              segment,
            });
          }
          void postWorkspaceResource(apiProjectTranscriptsUrl(projectRef.current), {
            content: text,
            is_final: true,
            spoken_at: new Date(capturedAt).toISOString(),
          });
        }
      }
    };
    r.onerror = () => {};
    try {
      r.start();
    } catch {
      /* ignore */
    }
    speechRecRef.current = r;
    return () => {
      try {
        r.stop();
      } catch {
        /* ignore */
      }
      speechRecRef.current = null;
    };
  }, [roomConnected, speechSupported, isGuest]);

  const stopMicPipeline = useCallback(() => {
    if (rafLoopRef.current != null) {
      cancelAnimationFrame(rafLoopRef.current);
      rafLoopRef.current = null;
    }
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    const ctx = audioCtxRef.current;
    audioCtxRef.current = null;
    analyserRef.current = null;
    freqDataRef.current = null;
    if (ctx && ctx.state !== 'closed') {
      void ctx.close();
    }
    setMicActive(false);
    barElRefs.current.forEach((el) => {
      if (el) el.style.transform = 'scaleY(0.12)';
    });
  }, []);

  useEffect(() => {
    if (!roomConnected) stopMicPipeline();
  }, [roomConnected, stopMicPipeline]);

  useEffect(() => () => stopMicPipeline(), [stopMicPipeline]);

  const toggleMic = useCallback(async () => {
    if (!roomConnected || micBusy) return;
    if (micActive) {
      stopMicPipeline();
      return;
    }
    setMicBusy(true);
    setMicError('');
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = stream;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) throw new Error('Web Audio API desteklenmiyor');
      const ctx = new AC();
      await ctx.resume();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.78;
      analyser.minDecibels = -92;
      analyser.maxDecibels = -18;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      freqDataRef.current = new Uint8Array(analyser.frequencyBinCount);
      setMicActive(true);

      const loop = () => {
        const a = analyserRef.current;
        const buf = freqDataRef.current;
        const bars = barElRefs.current;
        if (!a || !buf || !micStreamRef.current) return;
        a.getByteFrequencyData(buf);
        const n = buf.length;
        for (let i = 0; i < VOICE_BAR_COUNT; i += 1) {
          const i0 = Math.floor((i / VOICE_BAR_COUNT) * n);
          const i1 = Math.max(i0 + 1, Math.floor(((i + 1) / VOICE_BAR_COUNT) * n));
          let sum = 0;
          for (let j = i0; j < i1; j += 1) sum += buf[j];
          const avg = sum / (i1 - i0);
          const norm = Math.min(1, (avg / 255) ** 0.82);
          const scale = 0.1 + norm * 0.9;
          const el = bars[i];
          if (el) el.style.transform = `scaleY(${scale})`;
        }
        rafLoopRef.current = requestAnimationFrame(loop);
      };
      rafLoopRef.current = requestAnimationFrame(loop);
    } catch (e) {
      if (rafLoopRef.current != null) {
        cancelAnimationFrame(rafLoopRef.current);
        rafLoopRef.current = null;
      }
      stream?.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
      const c = audioCtxRef.current;
      audioCtxRef.current = null;
      analyserRef.current = null;
      freqDataRef.current = null;
      if (c && c.state !== 'closed') void c.close();
      setMicActive(false);
      setMicError(e instanceof Error ? e.message : 'Mikrofon açılamadı');
    } finally {
      setMicBusy(false);
    }
  }, [roomConnected, micActive, micBusy, stopMicPipeline]);

  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [chatMessages]);

  useEffect(() => {
    const map = blobMapRef.current;
    return () => {
      for (const { url } of map.values()) {
        URL.revokeObjectURL(url);
      }
      map.clear();
    };
  }, []);

  const revokeBlob = useCallback((id) => {
    const b = blobMapRef.current.get(id);
    if (b?.url) URL.revokeObjectURL(b.url);
    blobMapRef.current.delete(id);
  }, []);

  const addFiles = useCallback(
    async (list) => {
      if (isGuest) return;
      const arr = Array.from(list);
      if (!arr.length) return;
      setUploadBusy(true);
      try {
        const built = [];
        const p = projectRef.current;
        const pid = p?.id;
        if (!pid) return;
        const room = normalizeQuickRoomCode(roomCodeFromProjectId(pid));
        const prevFiles = Array.isArray(filesRef.current) ? filesRef.current : [];
        for (const f of arr) {
          built.push(await fileToEntry(f, blobMapRef.current));
          void postProjectMediaUpload(p, f);
        }
        onPatch({ files: [...prevFiles, ...built] });
        for (const entry of built) {
          const doc = { ...entry, uploadedAt: Date.now() };
          const sock = hostSocketRef.current;
          if (sock?.connected) {
            sock.emit('save-document', { roomCode: room, projectId: pid, document: doc });
          }
        }
      } finally {
        setUploadBusy(false);
      }
    },
    [onPatch, isGuest],
  );

  const removeFile = useCallback(
    (id) => {
      if (isGuest) return;
      revokeBlob(id);
      const prev = Array.isArray(filesRef.current) ? filesRef.current : [];
      onPatch({ files: prev.filter((f) => f.id !== id) });
      setPreviewId((cur) => (cur === id ? null : cur));
    },
    [onPatch, revokeBlob, isGuest],
  );

  const roomCode = useMemo(
    () => normalizeQuickRoomCode(roomCodeFromProjectId(project.id)),
    [project.id],
  );

  const copyRoomCode = useCallback(() => {
    void navigator.clipboard?.writeText(roomCode);
    setCopyRoom('copied');
    window.setTimeout(() => setCopyRoom('idle'), 2000);
  }, [roomCode]);

  const sendChatMessage = useCallback(() => {
    const t = chatDraft.trim();
    if (!t) return;
    const sentAt = Date.now();
    const id = crypto.randomUUID();
    const baseName = String(viewerDisplayName || '').trim() || 'Kullanıcı';
    const senderDisplayName = isGuest ? `${baseName} (misafir)` : baseName;
    const senderLabel = isGuest ? 'Misafir' : 'Siz';

    const room = isGuest
      ? normalizeQuickRoomCode(String(project.guestRoomCode ?? '').trim()) ||
        normalizeQuickRoomCode(roomCodeFromProjectId(project.id))
      : normalizeQuickRoomCode(roomCodeFromProjectId(project.id));

    const sock = isGuest
      ? guestSocket ?? guestSocketRef?.current ?? getGuestLiveSocket()
      : hostSocketRef.current;

    if (isGuest && !sock?.connected) return;

    const senderClientKey = isGuest ? String(sock?.id || '').trim() : 'host';
    const message = { id, text: t, sentAt, senderLabel, senderDisplayName, senderClientKey };

    setChatMessages((prev) => [...prev, message]);
    setChatDraft('');

    if (sock?.connected) {
      sock.emit('save-chat', { roomCode: room, projectId: project.id, message });
    }

    if (!isGuest) {
      void postWorkspaceResource(apiProjectChatLogsUrl(project), {
        message: t,
        sent_at: new Date(sentAt).toISOString(),
        message_kind: 'plain_text',
      });
    }
  }, [
    chatDraft,
    isGuest,
    project.id,
    project.guestRoomCode,
    guestSocket,
    guestSocketRef,
    viewerDisplayName,
  ]);

  const participants = useMemo(() => {
    const raw = normalizeParticipantsList(socketParticipants);
    raw.sort((a, b) => {
      if (a.role === 'host' && b.role !== 'host') return -1;
      if (a.role !== 'host' && b.role === 'host') return 1;
      return 0;
    });
    if (raw.length === 0) {
      return [
        {
          id: 'local-host',
          name: 'Siz',
          role: isGuest ? 'Misafir' : 'Oturum sahibi',
          online: true,
        },
      ];
    }
    return raw.map((p) => ({
      id: p.socketId,
      name: p.label || (p.role === 'host' ? 'Ev sahibi' : 'Misafir'),
      role: p.role === 'host' ? 'Oturum sahibi' : 'Misafir',
      online: true,
    }));
  }, [isGuest, socketParticipants]);

  const previewFile = previewId ? files.find((f) => f.id === previewId) : null;
  const previewBlob = previewFile ? blobMapRef.current.get(previewFile.id) : null;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setPreviewId(null);
    };
    if (previewId) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewId]);

  return (
    <div className="ses-ai-grid-bg relative flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-950 text-slate-100">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-white/10 bg-slate-900/75 px-4 py-2.5 backdrop-blur-md sm:gap-4 sm:px-5 sm:py-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-sm text-slate-400 transition hover:border-white/20 hover:text-slate-200"
        >
          <ArrowLeft size={18} />
          Projelere dön
        </button>
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-semibold tracking-tight text-white sm:text-base"
            title={project.name}
          >
            {project.name || 'Adsız proje'}
          </p>
          {isGuest ? (
            <span className="mt-1 inline-flex items-center rounded-full border border-amber-500/35 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-100">
              Misafir oturumu
            </span>
          ) : null}
        </div>
        {isGuest ? (
          <span className="hidden max-w-[220px] rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-center text-[11px] leading-snug text-slate-400 sm:inline">
            Diyagram tuvaline geçiş bu oturumda kapalıdır.
          </span>
        ) : (
          <button
            type="button"
            disabled={handoffBusy}
            onClick={() => void handleDiagramHandoff()}
            className="inline-flex min-w-[200px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition hover:from-emerald-500 hover:to-teal-500 disabled:cursor-wait disabled:opacity-90 sm:min-w-[220px] sm:px-5 sm:py-2.5"
          >
            {handoffBusy ? <Loader2 size={18} className="ses-ai-spinner shrink-0" aria-hidden /> : null}
            {handoffBusy ? 'Veriler hazırlanıyor...' : 'Diyagram tuvaline geç'}
          </button>
        )}
      </header>

      <div className="ses-workspace-grid min-h-0 flex-1 gap-4 overflow-hidden p-4 sm:gap-5 sm:p-5 lg:gap-6 lg:p-6">
        {/* Sol: Dosya / WhatsApp + Katılımcılar */}
        <div className="ses-ws-stack flex min-h-0 min-w-0 flex-1 flex-col gap-4">
          <section className="ses-glass-panel relative flex min-h-[min(44vh,300px)] flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 p-4 shadow-xl shadow-black/30 sm:min-h-0 sm:p-5">
            <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-violet-600/15 blur-3xl" aria-hidden />
            <div className="relative flex min-h-0 flex-1 flex-col">
              <div className="flex items-start gap-2 border-b border-white/10 pb-3">
                <Upload className="mt-0.5 shrink-0 text-emerald-400" size={18} />
                <div className="min-w-0">
                  <h2 className="text-sm font-bold tracking-tight text-white sm:text-base">Dosya &amp; WhatsApp entegrasyonu</h2>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400 sm:text-sm">
                    Dosyalarınızı veya WhatsApp sohbet dökümlerini sürükleyin; metin ve ses dosyaları analiz bağlamına eklenir.
                  </p>
                </div>
              </div>

              <input
                ref={inputRef}
                type="file"
                multiple
                accept=".txt,.md,.mp3,.wav,.m4a,.json,.csv,.log,.zip,text/*,audio/*,application/json"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) void addFiles(e.target.files);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                disabled={uploadBusy || isGuest}
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.dataTransfer.files?.length) void addFiles(e.dataTransfer.files);
                }}
                className={`group mt-3 flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-violet-500/35 bg-slate-950/50 px-4 py-8 transition hover:border-violet-400/55 hover:bg-slate-950/80 disabled:cursor-not-allowed disabled:opacity-50 sm:py-9 ${
                  isGuest ? 'pointer-events-none opacity-50' : ''
                }`}
              >
                <Upload className="text-emerald-400 transition group-hover:scale-105" size={24} strokeWidth={2} />
                <span className="text-center text-xs font-medium text-slate-300 sm:text-sm">
                  {uploadBusy ? 'Dosyalar işleniyor…' : 'Dosyalarınızı veya WhatsApp sohbet dökümlerini sürükleyin'}
                </span>
                <span className="text-[11px] text-slate-500">Çoklu seçim · metin / ses / arşiv</span>
              </button>

              <h3 className="mt-4 shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Yüklenen dosyalar
              </h3>
              <div className="mt-2 min-h-[140px] flex-1 overflow-y-auto rounded-lg border border-white/5 bg-slate-950/25 py-2 pl-1 pr-0 sm:min-h-[180px]">
                {files.length === 0 ? (
                  <p className="text-xs text-slate-500 sm:text-sm">Henüz dosya yok.</p>
                ) : (
                  <ul className="flex flex-col gap-2 pr-1">
                    {files.map((f) => {
                      const isAudio = f.kind === 'audio' || isAudioFile({ type: f.type, name: f.name });
                      const Icon = isAudio ? FileAudio : FileText;
                      const openable = canPreview(f, blobMapRef.current);
                      return (
                        <li
                          key={f.id}
                          className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 transition sm:gap-3 sm:px-3 ${
                            openable
                              ? 'border-emerald-500/25 bg-slate-950/50 hover:border-emerald-500/40'
                              : 'border-white/5 bg-slate-950/30'
                          }`}
                        >
                          <button
                            type="button"
                            disabled={!openable}
                            onClick={() => openable && setPreviewId(f.id)}
                            className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-0.5 text-left disabled:cursor-default sm:gap-3"
                          >
                            <Icon size={16} className={isAudio ? 'shrink-0 text-violet-300' : 'shrink-0 text-slate-500'} />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-xs font-medium text-slate-200 sm:text-sm">
                                {f.name}
                                {openable ? <span className="ml-1.5 text-[10px] font-semibold text-emerald-400 sm:text-xs">Aç</span> : null}
                              </div>
                              <div className="text-[10px] text-slate-500 sm:text-xs">
                                {formatBytes(f.size)}
                                {f.kind === 'text' && typeof f.textContent === 'string'
                                  ? ` · ${f.textContent.length.toLocaleString('tr-TR')} karakter`
                                  : null}
                              </div>
                            </div>
                          </button>
                          <button
                            type="button"
                            aria-label="Kaldır"
                            disabled={isGuest}
                            onClick={() => removeFile(f.id)}
                            className="shrink-0 rounded-md p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-rose-400 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <Trash2 size={16} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </section>

          <section className="ses-glass-panel flex max-h-[38vh] min-h-[140px] shrink-0 flex-col overflow-hidden rounded-2xl border border-white/10 p-4 shadow-lg shadow-black/25 sm:max-h-[42vh] sm:p-5">
            <div className="flex items-center gap-2 border-b border-white/10 pb-3">
              <Users className="text-sky-400" size={18} />
              <h2 className="text-sm font-bold text-white sm:text-base">Odada bulunanlar</h2>
            </div>
            <ul className="mt-3 flex flex-col gap-2 overflow-y-auto pr-1">
              {participants.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl border border-white/5 bg-slate-950/40 px-3 py-2.5"
                >
                  <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-600 to-slate-800 text-xs font-bold text-white">
                    {p.name.slice(0, 2).toUpperCase()}
                    {p.online ? (
                      <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-900 bg-emerald-500" aria-hidden />
                    ) : (
                      <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-900 bg-slate-600" aria-hidden />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-100">{p.name}</div>
                    <div className="truncate text-xs text-slate-500">{p.role}</div>
                  </div>
                </li>
              ))}
            </ul>
            {!isGuest ? (
              <p className="mt-2 border-t border-white/5 pt-2 text-[11px] leading-relaxed text-slate-500">
                Canlı oda arka planda açıktır; katılımcılar soket ile güncellenir. Misafirler oda koduyla anında katılabilir.
              </p>
            ) : null}
          </section>
        </div>

        {/* Orta: Sesli oda */}
        <section className="ses-glass-panel relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-slate-900/85 to-slate-950/95 p-4 shadow-xl shadow-emerald-950/20 backdrop-blur-xl sm:p-5">
          <div className="pointer-events-none absolute right-0 top-0 h-36 w-36 rounded-full bg-emerald-500/10 blur-3xl" aria-hidden />
          <div className="relative flex shrink-0 items-center gap-2 border-b border-white/10 pb-3">
            <Radio className="text-emerald-400" size={18} />
            <div>
              <h2 className="text-sm font-bold text-white sm:text-base">Sesli oda</h2>
              <p className="text-[11px] text-slate-500 sm:text-xs">Gerçek zamanlı dinleme ve mikrofon oturumu</p>
            </div>
          </div>

          {analysisContextReady ? (
            <div
              className="ses-ai-ready-banner mt-3 flex shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-400/35 px-3 py-2 text-xs font-bold text-emerald-100 sm:text-sm"
              role="status"
            >
              <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Analiz edilmeye hazır
            </div>
          ) : null}

          <div className="relative mt-4 flex min-h-[120px] flex-1 flex-col items-center justify-center py-6">
            {isGuest ? (
              <p className="max-w-xs px-2 text-center text-xs text-slate-500 sm:text-sm">
                Misafir olarak canlı oda soket üzerinden senkronize edilir; mikrofon ve seviye çubukları ev sahibine özeldir.
              </p>
            ) : !roomConnected ? (
              <div className="flex flex-col items-center gap-2 text-center text-slate-500">
                <MicOff className="opacity-50" size={36} />
                <p className="max-w-xs text-xs sm:text-sm">
                  &quot;Ses oturumunu başlat&quot; ile mikrofon ve seviye çubuklarını açın. Canlı oda misafirler için arka planda zaten açıktır.
                </p>
              </div>
            ) : (
              <div className="flex w-full max-w-xs flex-col items-center gap-3">
                <div
                  className={`ses-voice-waves flex h-16 items-end justify-center gap-1.5 sm:h-20 sm:gap-2 ${micActive ? 'ses-voice-waves--live' : 'ses-voice-waves--idle'}`}
                  aria-hidden
                >
                  {Array.from({ length: VOICE_BAR_COUNT }, (_, i) => (
                    <span
                      key={i}
                      ref={(el) => {
                        barElRefs.current[i] = el;
                      }}
                      className="ses-voice-meter-bar rounded-full"
                    />
                  ))}
                </div>
                {micError ? (
                  <p className="text-center text-[11px] leading-snug text-rose-400 sm:text-xs">{micError}</p>
                ) : (
                  <p className="text-center text-[11px] text-slate-500 sm:text-xs">
                    {micActive ? 'Konuştuğunuzda çubuklar ses şiddetine göre büyür.' : 'Mikrofon kapalı — çubuklar beklemede (gri).'}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="relative mt-auto shrink-0 space-y-3 border-t border-white/10 pt-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Oda kodu</p>
              <div className="mt-1.5 flex gap-2">
                <code className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950/70 px-2.5 py-2 font-mono text-xs font-semibold tracking-widest text-slate-100 sm:text-sm">
                  {roomCode}
                </code>
                <button
                  type="button"
                  onClick={copyRoomCode}
                  title="Kodu kopyala"
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[11px] font-semibold transition sm:gap-2 sm:px-3 sm:text-xs ${
                    copyRoom === 'copied'
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                      : 'border-white/10 bg-slate-950/50 text-slate-200 hover:border-white/20'
                  }`}
                >
                  {copyRoom === 'copied' ? <Check size={14} /> : <Copy size={14} />}
                  {copyRoom === 'copied' ? 'Kopyalandı' : 'Kopyala'}
                </button>
              </div>
            </div>
            {!isGuest ? (
            <div className="flex flex-wrap items-stretch gap-2">
              <button
                type="button"
                onClick={() => setRoomConnected(true)}
                disabled={roomConnected}
                className="inline-flex flex-1 min-w-[100px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-3 py-2.5 text-xs font-semibold text-white shadow-lg shadow-emerald-900/25 transition hover:from-emerald-500 hover:to-emerald-400 disabled:cursor-not-allowed disabled:opacity-40 sm:min-w-[120px] sm:text-sm"
              >
                <Mic size={16} />
                Ses oturumunu başlat
              </button>
              <button
                type="button"
                onClick={() => void toggleMic()}
                disabled={!roomConnected || micBusy}
                aria-pressed={micActive}
                title={micActive ? 'Mikrofonu kapat' : 'Mikrofonu aç'}
                className={`inline-flex shrink-0 items-center justify-center rounded-xl border px-3 py-2.5 transition sm:px-4 ${
                  micActive
                    ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                    : 'border-white/10 bg-slate-950/60 text-slate-400 hover:border-white/20 hover:text-slate-200'
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                {micBusy ? (
                  <Loader2 size={18} className="ses-ai-spinner" aria-hidden />
                ) : micActive ? (
                  <Mic size={18} aria-hidden />
                ) : (
                  <MicOff size={18} aria-hidden />
                )}
              </button>
              <button
                type="button"
                onClick={() => setRoomConnected(false)}
                disabled={!roomConnected}
                className="inline-flex flex-1 min-w-[100px] items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-35 sm:min-w-[120px] sm:text-sm"
              >
                Ses oturumunu kapat
              </button>
            </div>
            ) : null}
            {!isGuest ? (
            <p className="text-[10px] leading-relaxed text-slate-500">
              STT: {speechSupported ? 'Ses oturumu açıkken tarayıcı konuşma tanıma etkin; tamamlanan cümleler yalnızca arka planda transkript olarak kaydedilir (sohbet paneline düşmez).' : 'Bu tarayıcıda konuşma tanıma yok; yine de ses oturumu açılabilir.'}
            </p>
            ) : null}
          </div>
        </section>

        {/* Sağ: Toplantı sohbeti */}
        <section className="ses-glass-panel flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-cyan-500/15 bg-slate-900/60 shadow-xl shadow-black/30 backdrop-blur-xl">
          <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-4 py-3 sm:px-5">
            <MessageSquare className="text-cyan-400" size={18} />
            <div>
              <h2 className="text-sm font-bold text-white sm:text-base">Toplantı sohbeti</h2>
              <p className="text-[11px] text-slate-500">
                Yalnızca bu kutudan gönderilen yazılı mesajlar; analizde &quot;Mesajlar&quot; olarak birleşir
              </p>
            </div>
          </div>

          {roomConnected || isGuest ? (
            <div className="shrink-0 border-b border-sky-500/20 bg-gradient-to-r from-sky-950/70 to-slate-950/50 px-4 py-2 text-center sm:px-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-sky-400/90">Canlı</p>
              <p className="text-xs font-semibold text-sky-100 sm:text-sm">
                {isGuest
                  ? 'Misafir — mesajlarınız odadaki herkese iletilir'
                  : speechSupported && roomConnected
                    ? 'Dinleniyor… ses transkripti arka planda kaydediliyor'
                    : 'Oda açık'}
              </p>
            </div>
          ) : (
            <div className="shrink-0 border-b border-white/5 px-4 py-2 text-center text-[11px] text-slate-500 sm:px-5 sm:text-xs">
              Ses oturumu kapalıyken yalnızca yazılı mesaj ekleyebilirsiniz.
            </div>
          )}

          <div
            ref={chatScrollRef}
            className="ses-chat-scroll flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 py-3 sm:px-3 sm:py-4"
          >
            {chatMessages.filter((m) => String(m?.text || '').trim()).length === 0 ? (
              <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2 px-4 text-center text-xs text-slate-500 sm:text-sm">
                <p>Henüz yazılı mesaj yok.</p>
                <p className="max-w-sm">Ses transkriptleri bu panelde gösterilmez; yalnızca aşağıdaki kutudan gönderdiğiniz metinler burada listelenir.</p>
              </div>
            ) : (
              chatMessages
                .filter((m) => String(m?.text || '').trim())
                .map((m) => {
                  const own = messageIsOwnForViewer(m, isGuest, myChatClientKey);
                  const author = chatAuthorForContext(m, viewerDisplayName, isGuest);
                  return (
                    <div
                      key={m.id}
                      className={`flex w-full shrink-0 ${own ? 'justify-end pl-6' : 'justify-start pr-6'}`}
                    >
                      <div
                        className={`max-w-[min(88%,420px)] px-3.5 py-2.5 text-left shadow-md sm:px-4 sm:py-3 ${
                          own
                            ? 'rounded-2xl rounded-br-md bg-gradient-to-br from-emerald-600 to-cyan-700 text-white ring-1 ring-white/15'
                            : 'rounded-2xl rounded-bl-md border border-white/12 bg-slate-800/95 text-slate-100 ring-1 ring-black/20'
                        }`}
                      >
                        <div
                          className={`text-[11px] font-bold leading-tight sm:text-xs ${
                            own ? 'text-emerald-50' : 'text-cyan-200'
                          }`}
                        >
                          {author}
                        </div>
                        <div
                          className={`mt-0.5 text-[10px] font-medium ${
                            own ? 'text-emerald-100/80' : 'text-slate-500'
                          }`}
                        >
                          {formatTrTime(m.sentAt)}
                        </div>
                        <p
                          className={`mt-1.5 whitespace-pre-wrap break-words text-xs leading-relaxed sm:text-[13px] ${
                            own ? 'text-white' : 'text-slate-100'
                          }`}
                        >
                          {m.text}
                        </p>
                      </div>
                    </div>
                  );
                })
            )}
          </div>

          <div className="shrink-0 border-t border-white/10 bg-slate-950/50 p-3 sm:p-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendChatMessage();
                  }
                }}
                placeholder={
                  isGuest ? 'Misafir olarak mesaj yazın… (Enter ile gönder)' : 'Toplantıya not veya mesaj yazın…'
                }
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2.5 text-xs text-slate-100 outline-none ring-0 placeholder:text-slate-500 focus:border-cyan-500/40 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
              />
              <button
                type="button"
                onClick={sendChatMessage}
                disabled={
                  !chatDraft.trim() ||
                  (isGuest &&
                    !(guestSocket ?? guestSocketRef?.current ?? getGuestLiveSocket())?.connected)
                }
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 px-3 py-2.5 text-xs font-semibold text-white shadow-md transition hover:from-cyan-500 hover:to-sky-500 disabled:cursor-not-allowed disabled:opacity-40 sm:gap-2 sm:px-4 sm:text-sm"
              >
                <Send size={16} />
                <span className="hidden sm:inline">Gönder</span>
              </button>
            </div>
          </div>
        </section>
      </div>

      {previewFile && previewId ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="file-preview-title"
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/80 p-5 backdrop-blur-md"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPreviewId(null);
          }}
        >
          <div className="flex max-h-[min(85vh,640px)] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl shadow-black/50">
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div id="file-preview-title" className="truncate text-base font-bold text-white">
                  {previewFile.name}
                </div>
                <div className="text-xs text-slate-500">{formatBytes(previewFile.size)}</div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewId(null)}
                aria-label="Kapat"
                className="rounded-lg border border-white/10 p-2 text-slate-400 transition hover:bg-white/5 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4">
              {typeof previewFile.textContent === 'string' && previewFile.textContent.length > 0 ? (
                <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-slate-200">
                  {previewFile.textContent}
                </pre>
              ) : null}
              {previewBlob?.url ? (
                <div className="mt-4 flex flex-col gap-4">
                  <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/50 p-4">
                    <Headphones className="text-violet-400" size={28} />
                    <div>
                      <div className="text-sm font-semibold text-white">Ses önizleme</div>
                      <div className="text-xs text-slate-500">Yerel oynatıcı</div>
                    </div>
                  </div>
                  <audio controls src={previewBlob.url} className="w-full rounded-lg">
                    Tarayıcı ses etiketini desteklemiyor.
                  </audio>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      </div>
    </div>
  );
}
