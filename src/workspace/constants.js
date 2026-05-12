export const API_GENERATE_UML = 'http://127.0.0.1:8000/api/generate-uml';

/** Eski tek kullanıcılı anahtar; ilk girişte oturumdaki kullanıcıya taşınır */
const LEGACY_PROJECTS_KEY = 'sesmimari_projects_v1';

export function projectsStorageKey(userId) {
  return `sesmimari_projects_v1::${userId}`;
}

export const defaultDiagram = () => ({
  nodes: [
    {
      id: '1',
      position: { x: 50, y: 50 },
      data: { label: 'AuthClass' },
      style: {
        backgroundColor: '#1e293b',
        color: '#e2e8f0',
        border: '1px solid #10b981',
        borderRadius: '4px',
        padding: '10px',
        fontSize: '12px',
      },
    },
    {
      id: '2',
      position: { x: 250, y: 50 },
      data: { label: 'UserClass' },
      style: {
        backgroundColor: '#1e293b',
        color: '#e2e8f0',
        border: '1px solid #10b981',
        borderRadius: '4px',
        padding: '10px',
        fontSize: '12px',
      },
    },
    {
      id: '3',
      position: { x: 50, y: 150 },
      data: { label: 'Session' },
      style: {
        backgroundColor: '#1e293b',
        color: '#e2e8f0',
        border: '1px solid #10b981',
        borderRadius: '4px',
        padding: '10px',
        fontSize: '12px',
      },
    },
    {
      id: '4',
      position: { x: 250, y: 150 },
      data: { label: 'Project' },
      style: {
        backgroundColor: '#1e293b',
        color: '#e2e8f0',
        border: '1px solid #10b981',
        borderRadius: '4px',
        padding: '10px',
        fontSize: '12px',
      },
    },
  ],
  edges: [
    { id: 'e1-2', source: '1', target: '2', label: '1:1', style: { stroke: '#94a3b8' } },
    { id: 'e1-3', source: '1', target: '3', label: '1:*', style: { stroke: '#94a3b8' } },
    { id: 'e2-4', source: '2', target: '4', label: '1:1', style: { stroke: '#94a3b8' } },
  ],
});

function normalizeProject(p) {
  const d = defaultDiagram();
  return {
    ...p,
    nodes: Array.isArray(p.nodes) && p.nodes.length ? p.nodes : d.nodes,
    edges: Array.isArray(p.edges) && p.edges.length ? p.edges : d.edges,
    files: Array.isArray(p.files) ? p.files : [],
  };
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
