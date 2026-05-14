import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';

const PORT = Number(process.env.PORT || 3333);
const CORS_ORIGIN = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
  : true;

/** @type {Map<string, { projectId: string; projectName: string; files: unknown[]; chatLines: string[]; chatMessages: unknown[]; transcriptSegments: unknown[]; updatedAt: number }>} */
const rooms = new Map();

/** @type {Map<string, Map<string, { role: string; label: string }>>} oda kodu → socketId → meta */
const presenceByRoom = new Map();

function ensurePresenceMap(roomCode) {
  let m = presenceByRoom.get(roomCode);
  if (!m) {
    m = new Map();
    presenceByRoom.set(roomCode, m);
  }
  return m;
}

function setRoomPresence(roomCode, socketId, meta) {
  const key = canonicalRoomCode(roomCode) || roomCode;
  const m = ensurePresenceMap(key);
  m.set(socketId, meta);
  broadcastParticipants(key);
}

function removeRoomPresence(roomCode, socketId) {
  const key = canonicalRoomCode(roomCode) || roomCode;
  const m = presenceByRoom.get(key);
  if (!m || !m.delete(socketId)) return;
  if (m.size === 0) presenceByRoom.delete(key);
  broadcastParticipants(key);
}

function removeSocketPresenceEverywhere(socketId) {
  for (const roomCode of [...presenceByRoom.keys()]) {
    removeRoomPresence(roomCode, socketId);
  }
}

const ROOM_RE = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;

/** Frontend normalizeQuickRoomCode ile aynı mantık */
function canonicalRoomCode(raw) {
  const alnum = String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9]/g, '');
  if (alnum.length === 8) return `${alnum.slice(0, 4)}-${alnum.slice(4)}`;
  const fallback = String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  return ROOM_RE.test(fallback) ? fallback : '';
}

function formatEight(raw) {
  return canonicalRoomCode(raw);
}

function channelName(code) {
  const c = formatEight(code);
  return c ? `room:${c}` : 'room:';
}

function trTimeLabel(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n)) return '';
  return new Date(n).toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** Sohbet satırı: mesajdaki senderDisplayName / senderLabel */
function chatLineFromMessage(m) {
  const text = String(m?.text ?? '').trim();
  if (!text) return '';
  const ts = trTimeLabel(m?.sentAt);
  const who =
    typeof m?.senderDisplayName === 'string' && m.senderDisplayName.trim()
      ? m.senderDisplayName.trim()
      : typeof m?.senderLabel === 'string' && m.senderLabel.trim()
        ? m.senderLabel.trim()
        : 'Siz';
  return ts ? `[${ts}] ${who}: ${text}` : `${who}: ${text}`;
}

/** Aynı id ile çakışmayı önleyerek mesaj listelerini birleştirir; sentAt sıralı döner */
function mergeChatMessagesById(existing, incoming) {
  const byId = new Map();
  for (const m of Array.isArray(existing) ? existing : []) {
    if (m && typeof m === 'object' && typeof m.id === 'string' && m.id) byId.set(m.id, { ...m });
  }
  for (const m of Array.isArray(incoming) ? incoming : []) {
    if (m && typeof m === 'object' && typeof m.id === 'string' && m.id) byId.set(m.id, { ...m });
  }
  return [...byId.values()].sort((a, b) => (Number(a.sentAt) || 0) - (Number(b.sentAt) || 0));
}

function broadcastParticipants(roomCode) {
  const canonicalCode = canonicalRoomCode(roomCode);
  if (!canonicalCode || !ROOM_RE.test(canonicalCode)) return;
  const ch = channelName(canonicalCode);
  const m = presenceByRoom.get(canonicalCode);
  const participants = m
    ? [...m.entries()].map(([socketId, v]) => ({
        socketId,
        role: v.role,
        label: v.label,
      }))
    : [];
  // eslint-disable-next-line no-console
  console.log(`Oda: ${canonicalCode} - Mevcut Katılımcılar:`, participants);
  // eslint-disable-next-line no-console
  console.log('SUNUCUDAN YAYIN ÇIKTI -> ODA:', canonicalCode, 'KİŞİLER:', m ? Object.fromEntries(m) : {});
  /** Odadaki herkese (host + tüm misafirler); yeni giren de dahil */
  io.to(ch).emit('participants-sync', {
    roomCode: canonicalCode,
    roomId: canonicalCode,
    participants,
  });
}

function logRoomPresenceUpdated(canonicalCode) {
  // eslint-disable-next-line no-console
  console.log('>> ODA DURUMU GÜNCELLENDİ | ODA:', canonicalCode, 'KULLANICILAR:', presenceByRoom.get(canonicalCode));
}

const corsMiddleware = cors({ origin: CORS_ORIGIN, credentials: true });

const httpServer = http.createServer();

httpServer.prependListener('request', (req, res) => {
  const isRoot = req.method === 'GET' && (req.url === '/' || req.url?.startsWith('/?'));
  if (!isRoot) return;
  corsMiddleware(req, res, () => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('SesMimari canlı oda senkronu (socket.io).\n');
  });
});

const io = new Server(httpServer, {
  cors: { origin: CORS_ORIGIN, methods: ['GET', 'POST'], credentials: true },
});

io.on('connection', (socket) => {
  // eslint-disable-next-line no-console
  console.log(`[socket] bağlandı: ${socket.id}`);

  socket.on('join-room', async (payload, ack) => {
    const obj = typeof payload === 'object' && payload !== null ? payload : {};
    const raw =
      typeof payload === 'string' ? payload : obj.roomCode ?? obj.roomId ?? obj.room ?? '';
    const code = formatEight(String(raw).trim());
    if (!ROOM_RE.test(code)) {
      if (typeof ack === 'function') ack({ ok: false, error: 'INVALID_ROOM' });
      return;
    }
    const ch = channelName(code);
    try {
      await socket.join(ch);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[socket] join-room adapter hata', e);
      if (typeof ack === 'function') ack({ ok: false, error: 'JOIN_FAILED' });
      return;
    }
    const role = obj.role === 'guest' ? 'guest' : 'host';
    const label =
      typeof obj.label === 'string' && obj.label.trim()
        ? obj.label.trim()
        : role === 'host'
          ? 'Siz'
          : `Misafir (${socket.id.slice(-4)})`;
    setRoomPresence(code, socket.id, { role, label });
    logRoomPresenceUpdated(code);
    // eslint-disable-next-line no-console
    console.log(`[socket] join-room: ${socket.id} → ${ch} (${role})`);
    if (typeof ack === 'function') ack({ ok: true, room: code });
  });

  socket.on('host-publish', (payload) => {
    const code = formatEight(String(payload?.roomCode ?? '').trim());
    if (!ROOM_RE.test(code)) return;
    const prev = rooms.get(code);
    const incomingChat = Array.isArray(payload?.chatMessages)
      ? JSON.parse(JSON.stringify(payload.chatMessages))
      : [];
    const chatMessages = mergeChatMessagesById(prev?.chatMessages, incomingChat);
    const transcriptSegments = Array.isArray(payload?.transcriptSegments)
      ? JSON.parse(JSON.stringify(payload.transcriptSegments))
      : [];
    const chatLinesFromPayload = Array.isArray(payload?.chatLines) ? [...payload.chatLines] : [];
    const chatLines =
      chatMessages.length > 0
        ? chatMessages.map((m) => chatLineFromMessage(m)).filter(Boolean)
        : chatLinesFromPayload;
    const next = {
      projectId: String(payload?.projectId || prev?.projectId || ''),
      projectName: String(payload?.projectName || prev?.projectName || 'Proje'),
      files: Array.isArray(payload?.files) ? JSON.parse(JSON.stringify(payload.files)) : [],
      chatMessages,
      transcriptSegments,
      chatLines,
      updatedAt: Date.now(),
    };
    rooms.set(code, next);
    io.to(channelName(code)).emit('room-sync', {
      roomCode: code,
      files: next.files,
      chatLines: next.chatLines,
      chatMessages: next.chatMessages,
      transcriptSegments: next.transcriptSegments,
      projectName: next.projectName,
    });
  });

  socket.on('save-transcript', (payload) => {
    // eslint-disable-next-line no-console
    console.log('[save-transcript]', payload?.roomCode, payload?.projectId, payload?.segment);
  });
  socket.on('save-chat', (payload) => {
    const code = formatEight(String(payload?.roomCode ?? '').trim());
    if (!ROOM_RE.test(code)) return;
    const room = rooms.get(code);
    if (!room || !room.projectId) return;

    const msg = payload?.message;
    if (!msg || typeof msg !== 'object') return;
    const text = String(msg.text ?? '').trim();
    if (!text) return;

    const id =
      typeof msg.id === 'string' && msg.id.trim()
        ? msg.id.trim()
        : `m-${Date.now()}-${String(socket.id).slice(-6)}`;
    const sentAt = typeof msg.sentAt === 'number' ? msg.sentAt : Date.now();
    const senderFromMessage =
      typeof msg.senderLabel === 'string' && msg.senderLabel.trim() ? msg.senderLabel.trim() : '';
    const senderFromPayload =
      typeof payload?.senderLabel === 'string' && payload.senderLabel.trim()
        ? payload.senderLabel.trim()
        : '';
    const senderLabel = senderFromMessage || senderFromPayload || 'Katılımcı';
    const senderDisplayName =
      typeof msg.senderDisplayName === 'string' && msg.senderDisplayName.trim()
        ? msg.senderDisplayName.trim()
        : senderLabel;
    const senderClientKey =
      typeof msg.senderClientKey === 'string' && msg.senderClientKey.trim()
        ? msg.senderClientKey.trim()
        : '';
    const newMsg = { id, text, sentAt, senderLabel, senderDisplayName, senderClientKey };

    const chatMessages = mergeChatMessagesById(room.chatMessages, [newMsg]);
    const chatLines = chatMessages.map((m) => chatLineFromMessage(m)).filter(Boolean);

    const next = {
      ...room,
      chatMessages,
      chatLines,
      updatedAt: Date.now(),
    };
    rooms.set(code, next);
    io.to(channelName(code)).emit('room-sync', {
      roomCode: code,
      files: next.files,
      chatLines: next.chatLines,
      chatMessages: next.chatMessages,
      transcriptSegments: next.transcriptSegments,
      projectName: next.projectName,
    });
  });
  socket.on('save-document', (payload) => {
    // eslint-disable-next-line no-console
    console.log('[save-document]', payload?.roomCode, payload?.projectId, payload?.document);
  });

  socket.on('guest-request-join', async (payload, ack) => {
    const code = formatEight(String(payload?.roomCode ?? '').trim());
    if (!ROOM_RE.test(code)) {
      if (typeof ack === 'function') ack({ ok: false, code: 'INVALID' });
      return;
    }
    const room = rooms.get(code);
    if (!room || !room.projectId) {
      if (typeof ack === 'function') ack({ ok: false, code: 'NOT_FOUND' });
      return;
    }
    try {
      await socket.join(channelName(code));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[socket] guest-request-join adapter hata', e);
      if (typeof ack === 'function') ack({ ok: false, code: 'JOIN_FAILED' });
      return;
    }
    setRoomPresence(code, socket.id, {
      role: 'guest',
      label: `Misafir (${socket.id.slice(-4)})`,
    });
    /** Misafir join sonrası listeyi tüm odaya tekrar yayınla (senkron güvencesi) */
    broadcastParticipants(code);
    logRoomPresenceUpdated(code);
    if (typeof ack === 'function') {
      ack({
        ok: true,
        roomCode: code,
        projectId: room.projectId,
        projectName: room.projectName,
        files: room.files,
        chatLines: room.chatLines ?? [],
        chatMessages: room.chatMessages ?? [],
        transcriptSegments: room.transcriptSegments ?? [],
      });
    }
  });

  socket.on('leave-room-channel', async (payload) => {
    const code = formatEight(String(payload?.roomCode ?? '').trim());
    if (!ROOM_RE.test(code)) return;
    try {
      await socket.leave(channelName(code));
    } catch {
      /* ignore */
    }
    removeRoomPresence(code, socket.id);
  });

  socket.on('disconnect', (reason) => {
    removeSocketPresenceEverywhere(socket.id);
    // eslint-disable-next-line no-console
    console.log(`[socket] ayrıldı: ${socket.id} (${reason})`);
  });
});

httpServer.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[socket] http://localhost:${PORT}  (CORS: ${JSON.stringify(CORS_ORIGIN)})`);
});
