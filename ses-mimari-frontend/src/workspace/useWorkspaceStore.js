import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  defaultDiagram,
  loadProjects,
  saveProjects,
  prepareMeetingHandoffFromSession,
  readSessionUnified,
  SOCKET_URL,
  normalizeQuickRoomCode,
  isValidQuickRoomCode,
  findProjectByRoomCode,
  createBackendProject,
  FALLBACK_BACKEND_PROJECT_ID,
  clearProjectSessionCaches,
} from './constants';
import { assignGuestLiveSocket, clearGuestLiveSocket } from './guestSocketSingleton';

function newProject(name = 'Adsız Proje') {
  const d = defaultDiagram();
  return {
    id: crypto.randomUUID(),
    name,
    diagramType: 'class',
    createdAt: new Date().toISOString(),
    files: [],
    sourcesNotes: '',
    umlResult: '',
    nodes: d.nodes,
    edges: d.edges,
    sprintTasks: [],
  };
}

function cloneGuestFromLocalProject(local) {
  const d = defaultDiagram();
  const u = readSessionUnified(local.id);
  const chatMsgs = Array.isArray(u?.chatMessages) ? [...u.chatMessages] : [];
  const stt = Array.isArray(u?.sttTranscripts) ? [...u.sttTranscripts] : [];
  const legacy =
    !chatMsgs.length && !stt.length && Array.isArray(u?.transcriptLines) ? [...u.transcriptLines] : [];
  return {
    ...local,
    nodes: Array.isArray(local.nodes) && local.nodes.length ? local.nodes : d.nodes,
    edges: Array.isArray(local.edges) && local.edges.length ? local.edges : d.edges,
    isGuest: true,
    guestChatMessagesSeed: chatMsgs,
    guestTranscriptSeed: stt,
    guestLegacyTranscriptLines: legacy,
  };
}

/**
 * @param {string} userId Oturum kullanıcı kimliği (WorkspaceShell yalnızca girişliyken mount).
 */
export function useWorkspaceStore(userId) {
  const [projects, setProjects] = useState(() => loadProjects(userId));
  const [activeId, setActiveId] = useState(null);
  const [step, setStep] = useState(1);
  const [guestProject, setGuestProject] = useState(null);
  const [guestSocket, setGuestSocket] = useState(null);
  const guestSocketRef = useRef(null);

  useEffect(() => {
    saveProjects(userId, projects);
  }, [userId, projects]);

  const activeProject = useMemo(() => {
    if (guestProject && activeId && guestProject.id === activeId) return guestProject;
    return projects.find((p) => p.id === activeId) ?? null;
  }, [projects, activeId, guestProject]);

  const closeGuestSocket = useCallback(() => {
    const s = guestSocketRef.current;
    guestSocketRef.current = null;
    clearGuestLiveSocket();
    if (s) {
      try {
        s.emit('leave-room-channel', { roomCode: s.__roomCode });
      } catch {
        /* ignore */
      }
      try {
        s.close();
      } catch {
        /* ignore */
      }
    }
    setGuestSocket(null);
  }, []);

  const patchActive = useCallback(
    (partial) => {
      if (!activeId) return;
      if (guestProject?.id === activeId) {
        setGuestProject((prev) => (prev ? { ...prev, ...partial } : prev));
        return;
      }
      setProjects((prev) =>
        prev.map((p) => (p.id === activeId ? { ...p, ...partial } : p)),
      );
    },
    [activeId, guestProject?.id],
  );

  const startNewProject = useCallback(async () => {
    closeGuestSocket();
    setGuestProject(null);
    const base = newProject(`Yeni proje ${new Date().toLocaleDateString('tr-TR')}`);
    const remoteId = await createBackendProject({
      title: base.name || 'Yeni proje',
      description: '',
    });
    const backendId = remoteId ?? FALLBACK_BACKEND_PROJECT_ID;
    setProjects((prev) => [{ ...base, backendId }, ...prev]);
    setActiveId(base.id);
    setStep(2);
  }, [closeGuestSocket]);

  const openProject = useCallback(
    (id) => {
      closeGuestSocket();
      setGuestProject(null);
      setActiveId(id);
      setStep(2);
    },
    [closeGuestSocket],
  );

  const goHub = useCallback(() => {
    closeGuestSocket();
    setGuestProject(null);
    setStep(1);
    setActiveId(null);
  }, [closeGuestSocket]);

  const goSources = useCallback(() => {
    if (!activeId) return;
    setStep(2);
  }, [activeId]);

  const goDiagram = useCallback(() => {
    if (!activeId) return;
    setStep(3);
  }, [activeId]);

  const prepareDiagramHandoff = useCallback(async (project) => {
    if (!project?.id) return;
    await new Promise((resolve) => {
      requestAnimationFrame(() => resolve());
    });
    prepareMeetingHandoffFromSession(project);
  }, []);

  const readActiveSessionUnified = useCallback(() => (activeId ? readSessionUnified(activeId) : null), [activeId]);

  /**
   * Hub Hızlı Katılım: URL değiştirmeden Step 2 + hedef proje (misafir).
   * @returns {Promise<{ ok: boolean; error?: string; warning?: string }>}
   */
  const joinQuickRoom = useCallback(
    async (rawCode) => {
      const code = normalizeQuickRoomCode(rawCode);
      if (!isValidQuickRoomCode(code)) {
        return { ok: false, error: 'Geçerli bir oda kodu girin (örn: AB12-CD34 veya AB12CD34).' };
      }

      closeGuestSocket();
      setGuestProject(null);

      const openLocalGuest = () => {
        const local = findProjectByRoomCode(projects, code);
        if (!local) return null;
        setGuestProject(cloneGuestFromLocalProject(local));
        setActiveId(local.id);
        setStep(2);
        return true;
      };

      const s = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        timeout: 7500,
      });
      s.__roomCode = code;
      let resp;
      try {
        resp = await new Promise((resolve, reject) => {
          const t = window.setTimeout(() => reject(new Error('timeout')), 8500);
          s.emit('guest-request-join', { roomCode: code }, (r) => {
            clearTimeout(t);
            resolve(r);
          });
        });
      } catch {
        try {
          s.close();
        } catch {
          /* ignore */
        }
        if (openLocalGuest()) {
          return {
            ok: true,
            warning:
              'Sokete bağlanılamadı; yerel eşleşen proje misafir olarak açıldı. Senkron için socket sunucusunu (varsayılan :3333) başlatın.',
          };
        }
        return { ok: false, error: 'Bağlantı hatası. Soket sunucusu çalışıyor mu?' };
      }

      if (resp?.ok && resp.projectId) {
        const d = defaultDiagram();
        const gp = {
          id: resp.projectId,
          name: resp.projectName || `Oda ${code}`,
          diagramType: 'class',
          createdAt: new Date().toISOString(),
          files: Array.isArray(resp.files) ? resp.files : [],
          sourcesNotes: '',
          umlResult: '',
          nodes: d.nodes,
          edges: d.edges,
          isGuest: true,
          guestChatMessagesSeed: Array.isArray(resp.chatMessages) ? [...resp.chatMessages] : [],
          guestTranscriptSeed: Array.isArray(resp.transcriptSegments) ? [...resp.transcriptSegments] : [],
          guestLegacyTranscriptLines:
            (!Array.isArray(resp.chatMessages) || resp.chatMessages.length === 0) &&
            Array.isArray(resp.chatLines) &&
            resp.chatLines.length > 0
              ? [...resp.chatLines]
              : [],
          guestRoomCode: code,
          backendId: FALLBACK_BACKEND_PROJECT_ID,
        };
        guestSocketRef.current = s;
        assignGuestLiveSocket(s);
        setGuestProject(gp);
        setActiveId(resp.projectId);
        setStep(2);
        setGuestSocket(s);
        return { ok: true };
      }

      s.close();

      if (openLocalGuest()) {
        return {
          ok: true,
          warning:
            'Sokette aktif oda yok; bu hesaptaki eşleşen projenin yerel kopyası misafir olarak açıldı. Canlı senkron için ev sahibinin Kaynaklar ekranında olması gerekir.',
        };
      }

      return {
        ok: false,
        error:
          'Bu kodla eşleşen canlı oda veya yerel proje bulunamadı. Oda kodunu ve soket sunucusunu kontrol edin.',
      };
    },
    [projects, closeGuestSocket],
  );

  const deleteProject = useCallback(
    (projectId) => {
      const id = String(projectId ?? '').trim();
      if (!id) return;
      clearProjectSessionCaches(id);

      setGuestProject((gp) => {
        if (gp?.id === id) {
          closeGuestSocket();
          return null;
        }
        return gp;
      });

      let closedActive = false;
      setActiveId((cur) => {
        if (cur === id) {
          closedActive = true;
          return null;
        }
        return cur;
      });
      if (closedActive) setStep(1);

      setProjects((prev) => prev.filter((p) => p.id !== id));
    },
    [closeGuestSocket],
  );

  return {
    projects,
    activeProject,
    activeId,
    step,
    setStep,
    startNewProject,
    openProject,
    deleteProject,
    goHub,
    goSources,
    goDiagram,
    prepareDiagramHandoff,
    readActiveSessionUnified,
    patchActive,
    joinQuickRoom,
    guestSocket,
    guestSocketRef,
  };
}
