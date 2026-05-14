import { MarkerType } from 'reactflow';

/**
 * Vite `base` ile aynı kök; React Router `basename` (başında /, sonda / yok).
 * `base: '/'` iken undefined döner — Router varsayılan kökü kullanır.
 */
export function appRouterBasename() {
  const b = String(import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
  return b === '' ? undefined : b;
}

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || 'http://127.0.0.1:8000';

/** Laravel `projects.id` (integer) yoksa API çağrıları bu ID ile yapılır (acil test / yedek). */
export const FALLBACK_BACKEND_PROJECT_ID = 1;

export const API_GENERATE_UML = `${API_ORIGIN}/api/generate-uml`;
export const API_GENERATE_TASKS = `${API_ORIGIN}/api/generate-tasks`;

/**
 * Diyagramı görev API’sine göndermek için sadeleştirir.
 * @param {unknown[]} nodes
 * @param {unknown[]} edges
 */
export function slimDiagramForSprintTasks(nodes, edges) {
  return {
    nodes: (Array.isArray(nodes) ? nodes : []).map((n) => ({
      id: n?.id,
      data: { label: String(n?.data?.label ?? '').trim() || '—' },
    })),
    edges: (Array.isArray(edges) ? edges : []).map((e) => ({
      id: e?.id,
      source: e?.source,
      target: e?.target,
      label: e?.label != null ? String(e.label) : undefined,
    })),
  };
}

/**
 * /api/generate-tasks yanıtını projede saklanacak görev listesine çevirir.
 * @param {unknown} raw
 */
export function normalizeApiSprintTasks(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list.map((row) => {
    const r = row && typeof row === 'object' ? row : {};
    const title = String(r.title ?? r.task_name ?? 'Görev').trim() || 'Görev';
    return {
      id: crypto.randomUUID(),
      title,
      description: String(r.description ?? '').trim(),
      priority: String(r.priority ?? 'P2').trim(),
      area: String(r.area ?? 'other').trim(),
      acceptance_criteria: Array.isArray(r.acceptance_criteria) ? r.acceptance_criteria.map((x) => String(x)) : [],
      related_node_ids: Array.isArray(r.related_node_ids) ? r.related_node_ids.map((x) => String(x)) : [],
      sprint_label: String(r.sprint_label ?? 'Sprint 1').trim() || 'Sprint 1',
      done: false,
    };
  });
}

/**
 * Kayıtlı proje nesnesinden Laravel route parametresi.
 * @param {{ backendId?: number|string|null }|null|undefined} project
 */
export function resolveBackendProjectId(project) {
  if (project == null || typeof project !== 'object') return FALLBACK_BACKEND_PROJECT_ID;
  const n = Number(project.backendId);
  if (Number.isFinite(n) && n > 0) return Math.trunc(n);
  return FALLBACK_BACKEND_PROJECT_ID;
}

/**
 * POST /api/projects — Laravel `ProjectController@store` (title zorunlu).
 * @returns {Promise<number|null>} Oluşan integer `id` veya hata durumunda `null` (caller fallback kullanır).
 */
export async function createBackendProject({ title, description = '' }) {
  const url = `${API_ORIGIN}/api/projects`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        title: String(title || 'Yeni proje').slice(0, 255),
        description: description == null ? '' : String(description),
      }),
    });
    if (!res.ok) {
      let errPayload;
      try {
        errPayload = await res.json();
      } catch {
        try {
          errPayload = await res.text();
        } catch {
          errPayload = res.statusText;
        }
      }
      console.error('API HATASI (POST /api/projects):', errPayload, '| HTTP', res.status);
      return null;
    }
    const json = await res.json();
    const id = json?.data?.id ?? json?.id;
    if (id != null && Number.isFinite(Number(id))) return Math.trunc(Number(id));
    return null;
  } catch (err) {
    console.error('API HATASI (POST /api/projects):', err?.response?.data ?? err?.message ?? err);
    return null;
  }
}

/** Laravel `ProjectTranscriptController` / `ProjectChatController` / `ProjectMediaUploadController` — URL'de yalnızca integer backend id. */
export function apiProjectTranscriptsUrl(project) {
  const targetId = resolveBackendProjectId(project);
  return `${API_ORIGIN}/api/projects/${encodeURIComponent(String(targetId))}/transcripts`;
}

export function apiProjectChatLogsUrl(project) {
  const targetId = resolveBackendProjectId(project);
  return `${API_ORIGIN}/api/projects/${encodeURIComponent(String(targetId))}/chat-logs`;
}

export function apiProjectMediaUploadsUrl(project) {
  const targetId = resolveBackendProjectId(project);
  return `${API_ORIGIN}/api/projects/${encodeURIComponent(String(targetId))}/media-uploads`;
}

/** GET /api/projects/{backendId}/meeting-summary — kronolojik toplantı özeti (chat + transkript). */
export function apiProjectMeetingSummaryUrl(project) {
  const targetId = resolveBackendProjectId(project);
  return `${API_ORIGIN}/api/projects/${encodeURIComponent(String(targetId))}/meeting-summary`;
}

/**
 * @param {{ backendId?: number|string|null }|null|undefined} project
 * @returns {Promise<string>} JSON `summary` alanı veya hata durumunda boş string
 */
export async function fetchProjectMeetingSummary(project) {
  const bid = resolveBackendProjectId(project);
  console.log('İstek atılıyor. Kullanılan Backend ID (meeting-summary):', bid);
  const url = apiProjectMeetingSummaryUrl(project);
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      let errPayload;
      try {
        errPayload = await res.json();
      } catch {
        try {
          errPayload = await res.text();
        } catch {
          errPayload = res.statusText;
        }
      }
      console.error('API HATASI (meeting-summary):', errPayload, '| HTTP', res.status);
      return '';
    }
    const data = await res.json().catch(() => ({}));
    return typeof data?.summary === 'string' ? data.summary : '';
  } catch (err) {
    console.error('API HATASI (meeting-summary):', err?.response?.data ?? err?.message ?? err);
    return '';
  }
}

/**
 * Route'ta yalnızca sayısal backend id varken meeting-summary için minimal proje kılıfı.
 * @param {string|number} routeOrBackendId
 */
export function meetingSummaryProjectStub(routeOrBackendId) {
  const raw = String(routeOrBackendId ?? '').trim();
  if (/^\d+$/.test(raw)) {
    return { backendId: Math.trunc(Number(raw)) };
  }
  return { backendId: FALLBACK_BACKEND_PROJECT_ID };
}

/** Canlı oda senkronu (Hızlı Katılım / host yayını) */
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3333';

const ROOM_CODE_RE = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;

/** "elz-2026" / "ELZ8738" / "ELZ-8738" → ABCD-1234 (trim + büyük harf + tek biçim) */
export function normalizeQuickRoomCode(raw) {
  const alnum = String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9]/g, '');
  if (alnum.length === 8) return `${alnum.slice(0, 4)}-${alnum.slice(4)}`;
  return String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

export function isValidQuickRoomCode(code) {
  return ROOM_CODE_RE.test(normalizeQuickRoomCode(code));
}

/** Proje UUID → Kaynaklar ekranındaki oda kodu ile aynı kural */
export function roomCodeFromProjectId(projectId) {
  const raw = String(projectId ?? '')
    .trim()
    .replace(/-/g, '');
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`.toUpperCase();
}

/** Yerel proje listesinde oda koduna göre eşleştirme (socket yokken yedek) */
export function findProjectByRoomCode(projects, rawCode) {
  const code = normalizeQuickRoomCode(rawCode);
  if (!isValidQuickRoomCode(code)) return null;
  return (projects || []).find((p) => roomCodeFromProjectId(p.id) === code) ?? null;
}

/** Eski tek kullanıcılı anahtar; ilk girişte oturumdaki kullanıcıya taşınır */
const LEGACY_PROJECTS_KEY = 'sesmimari_projects_v1';

export function projectsStorageKey(userId) {
  return `sesmimari_projects_v1::${userId}`;
}

const RF_ARROW_MARKER_END = { type: MarkerType.ArrowClosed, width: 18, height: 18 };

const DEFAULT_EDGE_STROKE = '#64748b';

/** Kesik çizgi yok; kenarlar düz (solid) çizgi olarak normalize edilir */
function normalizeSolidEdgeStyle(styleObj) {
  const s =
    styleObj && typeof styleObj === 'object' && !Array.isArray(styleObj)
      ? { stroke: DEFAULT_EDGE_STROKE, ...styleObj }
      : { stroke: DEFAULT_EDGE_STROKE };
  delete s.strokeDasharray;
  delete s.strokeDashoffset;
  return s;
}

function hexToRgbForLuminance(hex) {
  const m = String(hex)
    .trim()
    .match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** Açık arka planda koyu metin; koyu arka planda açık metin */
export function applyReadableNodeTextColor(style) {
  const out = { ...style };
  const bg = out.backgroundColor;
  if (typeof bg !== 'string' || !bg.trim()) {
    out.color = out.color || '#0a1628';
    return out;
  }
  const rgb = hexToRgbForLuminance(bg);
  if (!rgb) {
    out.color = out.color || '#0a1628';
    return out;
  }
  const L = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  if (L > 0.58) {
    out.color = '#0a1628';
  } else if (!out.color || !String(out.color).trim()) {
    out.color = '#e2e8f0';
  }
  return out;
}

export const defaultDiagram = () => ({
  nodes: [
    {
      id: '1',
      position: { x: 50, y: 50 },
      data: { label: 'AuthClass' },
      style: applyReadableNodeTextColor({
        backgroundColor: '#f8fafc',
        color: '#0a1628',
        border: '1px solid #10b981',
        borderRadius: '4px',
        padding: '10px',
        fontSize: '12px',
      }),
    },
    {
      id: '2',
      position: { x: 250, y: 50 },
      data: { label: 'UserClass' },
      style: applyReadableNodeTextColor({
        backgroundColor: '#f8fafc',
        color: '#0a1628',
        border: '1px solid #10b981',
        borderRadius: '4px',
        padding: '10px',
        fontSize: '12px',
      }),
    },
    {
      id: '3',
      position: { x: 50, y: 150 },
      data: { label: 'Session' },
      style: applyReadableNodeTextColor({
        backgroundColor: '#f8fafc',
        color: '#0a1628',
        border: '1px solid #10b981',
        borderRadius: '4px',
        padding: '10px',
        fontSize: '12px',
      }),
    },
    {
      id: '4',
      position: { x: 250, y: 150 },
      data: { label: 'Project' },
      style: applyReadableNodeTextColor({
        backgroundColor: '#f8fafc',
        color: '#0a1628',
        border: '1px solid #10b981',
        borderRadius: '4px',
        padding: '10px',
        fontSize: '12px',
      }),
    },
  ],
  edges: [
    {
      id: 'e1-2',
      source: '1',
      target: '2',
      label: '1:1',
      style: { stroke: '#64748b' },
      markerEnd: RF_ARROW_MARKER_END,
    },
    {
      id: 'e1-3',
      source: '1',
      target: '3',
      label: '1:N',
      style: { stroke: '#64748b' },
      markerEnd: RF_ARROW_MARKER_END,
    },
    {
      id: 'e2-4',
      source: '2',
      target: '4',
      label: '1:1',
      style: { stroke: '#64748b' },
      markerEnd: RF_ARROW_MARKER_END,
    },
  ],
});

const defaultReactFlowNodeStyle = () =>
  applyReadableNodeTextColor({
    backgroundColor: '#f8fafc',
    color: '#0a1628',
    border: '1px solid #10b981',
    borderRadius: '4px',
    padding: '10px',
    fontSize: '12px',
  });

/** AI düğümlerini soldan sağa sütunlara, her sütunda alttan üste (y azalarak) yerleştirir. */
export function applyOrthogonalBottomUpGridLayout(nodes) {
  if (!Array.isArray(nodes) || nodes.length === 0) return nodes;
  const START_X = 72;
  const COL_W = 260;
  const ROW_H = 148;
  const BASE_Y = 580;
  const MAX_ROWS_PER_COLUMN = 5;

  return nodes.map((node, i) => {
    const col = Math.floor(i / MAX_ROWS_PER_COLUMN);
    const rowFromBottom = i % MAX_ROWS_PER_COLUMN;
    const x = START_X + col * COL_W;
    const y = BASE_Y - rowFromBottom * ROW_H;
    return { ...node, position: { x, y } };
  });
}

/**
 * POST /api/generate-uml yanıtını React Flow state'ine güvenli biçimde dönüştürür.
 * @param {unknown} data
 * @returns {{ nodes: object[], edges: object[] } | null}
 */
export function normalizeAiReactFlowPayload(data) {
  if (!data || typeof data !== 'object') return null;
  const rawNodes = data.nodes;
  const rawEdges = data.edges;
  if (!Array.isArray(rawNodes) || rawNodes.length === 0) return null;
  if (!Array.isArray(rawEdges)) return null;

  const fallbackStyle = defaultReactFlowNodeStyle();

  const nodes = applyOrthogonalBottomUpGridLayout(
    rawNodes.map((n, i) => {
      const id = n?.id != null && String(n.id).trim() !== '' ? String(n.id) : `n-${i}`;
      const labelRaw = n?.data?.label ?? n?.label;
      const label = typeof labelRaw === 'string' && labelRaw.trim() ? labelRaw.trim() : `Bileşen ${i + 1}`;
      const merged =
        n?.style && typeof n.style === 'object' && !Array.isArray(n.style)
          ? { ...fallbackStyle, ...n.style }
          : { ...fallbackStyle };
      const style = applyReadableNodeTextColor(merged);

      return {
        id,
        type: typeof n.type === 'string' ? n.type : undefined,
        position: { x: 0, y: 0 },
        data: { label },
        style,
      };
    }),
  );

  const idSet = new Set(nodes.map((n) => n.id));

  let edges = rawEdges
    .map((e, i) => {
      const id = e?.id != null && String(e.id).trim() !== '' ? String(e.id) : `e-${i}`;
      const source = e?.source != null ? String(e.source) : '';
      const target = e?.target != null ? String(e.target) : '';
      if (!source || !target || !idSet.has(source) || !idSet.has(target)) return null;
      const edge = {
        id,
        source,
        target,
        style: normalizeSolidEdgeStyle(e?.style),
        markerEnd:
          e?.markerEnd && typeof e.markerEnd === 'object' && e.markerEnd.type
            ? e.markerEnd
            : { ...RF_ARROW_MARKER_END },
      };
      if (e?.label != null && String(e.label).trim() !== '') {
        edge.label = String(e.label);
      }
      return edge;
    })
    .filter(Boolean);

  if (edges.length === 0 && nodes.length >= 2) {
    edges = [
      {
        id: 'e-auto-0',
        source: nodes[0].id,
        target: nodes[1].id,
        style: normalizeSolidEdgeStyle(undefined),
        markerEnd: { ...RF_ARROW_MARKER_END },
      },
    ];
  }

  return { nodes, edges };
}

function normalizeDiagramType(p) {
  const t = p?.diagramType;
  if (t === 'class' || t === 'use_case') return t;
  if (p?.diagramLabel === 'Use Case') return 'use_case';
  return 'class';
}

/** @param {unknown} type */
export function formatDiagramTypeLabel(type) {
  return type === 'use_case' ? 'Use Case' : 'Sınıf Diyagramı';
}

function normalizeProject(p) {
  const d = defaultDiagram();
  const rawBid = p?.backendId;
  const backendId =
    rawBid != null && rawBid !== '' && Number.isFinite(Number(rawBid)) && Number(rawBid) > 0
      ? Math.trunc(Number(rawBid))
      : FALLBACK_BACKEND_PROJECT_ID;
  return {
    ...p,
    backendId,
    diagramType: normalizeDiagramType(p),
    nodes: Array.isArray(p.nodes) && p.nodes.length ? p.nodes : d.nodes,
    edges: Array.isArray(p.edges) && p.edges.length ? p.edges : d.edges,
    files: Array.isArray(p.files) ? p.files : [],
    sourcesNotes: typeof p.sourcesNotes === 'string' ? p.sourcesNotes : '',
    sprintTasks: Array.isArray(p.sprintTasks) ? p.sprintTasks : [],
  };
}

/** Dosya listesini ad + id ile deterministik sıralar (birleşik metin ve el sıkışması tutarlılığı için). */
export function sortWorkspaceFilesDeterministic(files = []) {
  return [...files].sort((a, b) => {
    const an = String(a?.name ?? '').toLocaleLowerCase('tr');
    const bn = String(b?.name ?? '').toLocaleLowerCase('tr');
    if (an !== bn) return an.localeCompare(bn, 'tr');
    return String(a?.id ?? '').localeCompare(String(b?.id ?? ''));
  });
}

const LEGACY_IMPORTED_FLAG = 'sesmimari_legacy_imported_v1';

/**
 * Kullanıcıya özel proje listesi. Yeni hesapta [].
 * Eski `sesmimari_projects_v1` verisi bu tarayıcıda yalnızca bir kez, ilk içe aktarımda oturumdaki kullanıcıya taşınır.
 */
export function loadProjects(userId) {
  if (!userId) return [];
  const key = projectsStorageKey(userId);
  const raw = localStorage.getItem(key);
  if (raw !== null) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map(normalizeProject);
      }
    } catch {
      return [];
    }
    return [];
  }

  try {
    if (!localStorage.getItem(LEGACY_IMPORTED_FLAG)) {
      const legacy = localStorage.getItem(LEGACY_PROJECTS_KEY);
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const list = parsed.map(normalizeProject);
          saveProjects(userId, list);
          localStorage.removeItem(LEGACY_PROJECTS_KEY);
          localStorage.setItem(LEGACY_IMPORTED_FLAG, '1');
          return list;
        }
      }
    }
  } catch {
    /* fallthrough */
  }
  return [];
}

export function saveProjects(userId, list) {
  if (!userId) return;
  try {
    localStorage.setItem(projectsStorageKey(userId), JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

/** Tuval / API el sıkışması: proje bazlı birleşik analiz yükü */
export function meetingStorageKey(projectId) {
  return `meeting:${projectId}`;
}

/** Adım 2 sırasında canlı güncellenen birleşik bağlam (dosya + transkript meta) */
export function sessionUnifiedKey(projectId) {
  return `sessionUnified:${projectId}`;
}

/** Proje silindiğinde tarayıcıdaki oturum / diyagram el sıkışması önbelleğini kaldırır */
export function clearProjectSessionCaches(projectId) {
  const id = String(projectId ?? '').trim();
  if (!id) return;
  try {
    sessionStorage.removeItem(sessionUnifiedKey(id));
    sessionStorage.removeItem(meetingStorageKey(id));
  } catch {
    /* ignore */
  }
}

/**
 * @param {number} ms
 */
export function formatTrTime(ms) {
  if (typeof ms !== 'number' || Number.isNaN(ms)) return '';
  return new Date(ms).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function projectIdFromProjectsApiUrl(url) {
  if (typeof url !== 'string') return null;
  const m = url.match(/\/api\/projects\/([^/]+)\//);
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * JSON POST; Laravel validation / HTTP hatalarında konsola yazar (sessiz yutmaz).
 * @param {string} url
 * @param {Record<string, unknown>} body
 * @param {{ backendId?: string|number }} [options]
 */
export async function postWorkspaceResource(url, body, options = {}) {
  const targetId = options.backendId ?? projectIdFromProjectsApiUrl(url);
  console.log('İstek atılıyor. Kullanılan Backend ID:', targetId);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let errPayload;
      try {
        errPayload = await res.json();
      } catch {
        try {
          errPayload = await res.text();
        } catch {
          errPayload = res.statusText;
        }
      }
      console.error('API HATASI:', errPayload, '| HTTP', res.status);
    }
  } catch (err) {
    console.error('API HATASI:', err?.response?.data ?? err?.message ?? err);
  }
}

/**
 * `StoreProjectMediaUploadRequest`: multipart `file` alanı (mp3,wav,m4a,webm,ogg,txt).
 * @param {{ backendId?: number|string|null }} project
 * @param {File} file
 */
export async function postProjectMediaUpload(project, file) {
  const targetId = resolveBackendProjectId(project);
  console.log('İstek atılıyor. Kullanılan Backend ID:', targetId);
  const url = apiProjectMediaUploadsUrl(project);
  try {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(url, {
      method: 'POST',
      body: fd,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      let errPayload;
      try {
        errPayload = await res.json();
      } catch {
        try {
          errPayload = await res.text();
        } catch {
          errPayload = res.statusText;
        }
      }
      console.error('API HATASI:', errPayload, '| HTTP', res.status);
    }
  } catch (err) {
    console.error('API HATASI:', err?.response?.data ?? err?.message ?? err);
  }
}

function sessionSttLinesFromRecords(sttTranscripts) {
  return (Array.isArray(sttTranscripts) ? sttTranscripts : [])
    .map((t) => {
      const text = String(t?.text ?? '').trim();
      if (!text) return '';
      const ts = formatTrTime(t?.capturedAt);
      return ts ? `[${ts}] ${text}` : text;
    })
    .filter(Boolean);
}

function sessionChatLinesFromRecords(chatMessages) {
  return (Array.isArray(chatMessages) ? chatMessages : [])
    .map((m) => {
      const text = String(m?.text ?? '').trim();
      if (!text) return '';
      const ts = formatTrTime(m?.sentAt);
      const who =
        String(m?.senderDisplayName ?? '').trim() ||
        String(m?.senderLabel ?? '').trim() ||
        'Katılımcı';
      return ts ? `[${ts}] ${who}: ${text}` : `${who}: ${text}`;
    })
    .filter(Boolean);
}

export function buildAnalysisContextFromUnified({ files = [], transcriptLines = [], notes = '', messages = '' }) {
  const parts = [];
  const n = String(notes || '').trim();
  const m = String(messages || '').trim();
  if (n) parts.push(`[Notlar]\n${n}`);
  if (m) parts.push(`[Mesajlar]\n${m}`);
  for (const line of transcriptLines || []) {
    const t = String(line || '').trim();
    if (t) parts.push(t);
  }
  for (const f of files || []) {
    if (f?.kind === 'text' && typeof f.textContent === 'string' && f.textContent.trim()) {
      parts.push(`[Dosya: ${f.name || 'dosya'}]\n${f.textContent.trim()}`);
    } else if (f?.kind === 'audio' || /\.(mp3|wav|m4a|webm|ogg)$/i.test(String(f?.name || ''))) {
      parts.push(`[Ses: ${f.name || 'kayıt'}] (Bu oturumda ham ses; metin transkripti ayrıca eklenir.)`);
    }
  }
  return parts.join('\n\n').trim();
}

export function readSessionUnified(projectId) {
  try {
    const raw = sessionStorage.getItem(sessionUnifiedKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function writeSessionUnified(projectId, partial) {
  const prev = readSessionUnified(projectId) || {};
  const next = {
    version: 1,
    ...prev,
    ...partial,
    updatedAt: new Date().toISOString(),
  };
  try {
    sessionStorage.setItem(sessionUnifiedKey(projectId), JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

/**
 * Kaynaklar adımında STT, yazılı sohbet ve dosyalar ayrı kanallar; analiz birleşiminde
 * transkript satırları = yalnızca ses/STT, messages = yalnızca chat.
 */
export function syncLiveAnalysisContext(project, { sttTranscripts = [], chatMessages = [] } = {}) {
  if (!project?.id) return;
  const notes = String(project?.sourcesNotes ?? '').trim();
  const files = sortWorkspaceFilesDeterministic(project?.files ?? []);
  const sttLines = sessionSttLinesFromRecords(sttTranscripts);
  const chatBlock = sessionChatLinesFromRecords(chatMessages).join('\n');
  const analysisContext = buildAnalysisContextFromUnified({
    files,
    transcriptLines: sttLines,
    notes,
    messages: chatBlock,
  });
  writeSessionUnified(project.id, {
    sttTranscripts: [...sttTranscripts],
    chatMessages: [...chatMessages],
    transcriptLines: [...sttLines],
    sourcesNotes: project?.sourcesNotes ?? '',
    analysisContext,
  });
}

/**
 * Diyagram adımı el sıkışması: `sessionUnified:{id}` + güncel proje dosyaları birleştirilir,
 * `meeting:{id}` altına yalnızca `analysisContext` ve `updatedAt` yazılır.
 */
export function prepareMeetingHandoffFromSession(project) {
  if (!project?.id) return;
  const u = readSessionUnified(project.id) || {};
  let sttTranscripts = Array.isArray(u.sttTranscripts) ? [...u.sttTranscripts] : [];
  let chatMessages = Array.isArray(u.chatMessages) ? [...u.chatMessages] : [];
  if (!sttTranscripts.length && !chatMessages.length && Array.isArray(u.transcriptLines)) {
    for (const line of u.transcriptLines) {
      const s = String(line || '');
      if (!s.trim()) continue;
      if (/\bSiz:\s*/i.test(s)) {
        const text = s.replace(/^.*?\]\s*Siz:\s*/i, '').replace(/^.*Siz:\s*/i, '').trim();
        if (text) chatMessages.push({ id: crypto.randomUUID(), text, sentAt: Date.now() });
      } else {
        const text = s.replace(/^\[[^\]]+\]\s*/, '').trim();
        if (text) sttTranscripts.push({ id: crypto.randomUUID(), text, capturedAt: Date.now() });
      }
    }
  }
  const sttLines = sessionSttLinesFromRecords(sttTranscripts);
  const chatBlock = sessionChatLinesFromRecords(chatMessages).join('\n');
  const notes = String(u.sourcesNotes ?? project.sourcesNotes ?? '').trim();
  const files = sortWorkspaceFilesDeterministic(project?.files ?? []);
  const analysisContext = buildAnalysisContextFromUnified({
    files,
    transcriptLines: sttLines,
    notes,
    messages: chatBlock,
  });
  const payload = {
    analysisContext,
    updatedAt: new Date().toISOString(),
  };
  try {
    sessionStorage.setItem(meetingStorageKey(project.id), JSON.stringify(payload));
  } catch {
    /* ignore */
  }
  writeSessionUnified(project.id, {
    ...u,
    sttTranscripts,
    chatMessages,
    transcriptLines: [...sttLines],
    sourcesNotes: project?.sourcesNotes ?? u.sourcesNotes ?? '',
    analysisContext,
    handoffReady: true,
  });
}

/** @deprecated prepareMeetingHandoffFromSession kullanın */
export const persistMeetingBundleForDiagram = prepareMeetingHandoffFromSession;

/** Oda / veri toplama aşamasında sessionStorage'a yazılan meeting:* kayıtlarını birleştirir */
export function collectSessionMeetingContexts() {
  const parts = [];
  try {
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (!key || !key.startsWith('meeting:')) continue;
      const raw = sessionStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const ac = typeof parsed.analysisContext === 'string' ? parsed.analysisContext.trim() : '';
      const block = ac || [parsed.notes, parsed.messages].filter(Boolean).join('\n').trim();
      if (block) parts.push(block);
    }
  } catch {
    /* ignore */
  }
  return parts.join('\n\n');
}

/** Tek bir proje için meeting:{id} içindeki analiz yükünü döndürür */
export function collectMeetingContextForProject(projectId) {
  try {
    const raw = sessionStorage.getItem(meetingStorageKey(projectId));
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    const ac = typeof parsed.analysisContext === 'string' ? parsed.analysisContext.trim() : '';
    return ac || [parsed.notes, parsed.messages].filter(Boolean).join('\n').trim();
  } catch {
    return '';
  }
}

/** Kaynaklar adımında yüklenen metin dosyalarından analiz metni üretir */
export function buildAnalysisTextFromWorkspaceFiles(project) {
  const parts = [];
  for (const f of project?.files ?? []) {
    if (f?.kind === 'text' && typeof f.textContent === 'string' && f.textContent.trim()) {
      parts.push(`[${f.name || 'dosya'}]\n${f.textContent.trim()}`);
    }
  }
  return parts.join('\n\n');
}
