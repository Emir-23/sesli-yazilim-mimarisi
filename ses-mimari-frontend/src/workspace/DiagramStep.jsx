import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, { Background, Controls, applyEdgeChanges, applyNodeChanges, MarkerType } from 'reactflow';
import { toPng } from 'html-to-image';
import 'reactflow/dist/style.css';
import {
  ArrowLeft,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  UserCircle,
} from 'lucide-react';
import {
  API_GENERATE_TASKS,
  API_GENERATE_UML,
  buildAnalysisTextFromWorkspaceFiles,
  collectMeetingContextForProject,
  fetchProjectMeetingSummary,
  normalizeApiSprintTasks,
  normalizeAiReactFlowPayload,
  slimDiagramForSprintTasks,
} from './constants';
import './sources-workspace.css';

function slugifyForFilename(name) {
  const raw = (name || 'proje').trim() || 'proje';
  try {
    return raw
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'proje';
  } catch {
    return raw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'proje';
  }
}

export default function DiagramStep({ project, onBack, onPatch }) {
  const [umlLoading, setUmlLoading] = useState(false);
  const [umlError, setUmlError] = useState('');
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState('');
  const [exportPngLoading, setExportPngLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const flowMountRef = useRef(null);

  const nodes = useMemo(() => project.nodes ?? [], [project.nodes]);
  const edges = useMemo(() => project.edges ?? [], [project.edges]);

  const showToast = useCallback((message, variant = 'error') => {
    setToast({ message, variant, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4800);
    return () => window.clearTimeout(t);
  }, [toast]);

  const onNodesChange = useCallback(
    (changes) => {
      onPatch({ nodes: applyNodeChanges(changes, nodes) });
    },
    [nodes, onPatch],
  );

  const onEdgesChange = useCallback(
    (changes) => {
      onPatch({ edges: applyEdgeChanges(changes, edges) });
    },
    [edges, onPatch],
  );

  const handleExportPng = useCallback(async () => {
    const root = flowMountRef.current;
    const rfEl = root?.querySelector('.react-flow');
    if (!rfEl) {
      showToast('Tuval bulunamadı.', 'error');
      return;
    }
    setExportPngLoading(true);
    try {
      const dataUrl = await toPng(rfEl, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#1e293b',
        filter: (node) => {
          if (node instanceof HTMLElement && node.classList.contains('react-flow__controls')) {
            return false;
          }
          return true;
        },
      });
      const slug = slugifyForFilename(project.name);
      const filename = `${slug}-uml-diyagrami.png`;
      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      link.click();
      showToast('PNG indirildi.', 'success');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Dışa aktarma başarısız';
      showToast(msg, 'error');
    } finally {
      setExportPngLoading(false);
    }
  }, [project.name, showToast]);

  const handleGenerateUml = useCallback(async () => {
    setUmlError('');
    const chronological = (await fetchProjectMeetingSummary(project)).trim();
    const fromFiles = buildAnalysisTextFromWorkspaceFiles(project).trim();
    const fromMeeting = collectMeetingContextForProject(project.id).trim();

    let text = '';
    if (chronological) {
      text = `[Toplantı özeti — veritabanı (kronolojik)]\n${chronological}`;
      if (fromFiles) {
        text += `\n\n[Kaynak dosyaları]\n${fromFiles}`;
      }
    } else {
      text = [fromFiles, fromMeeting].filter(Boolean).join('\n\n').trim();
    }

    if (!text) {
      onPatch({ umlResult: '' });
      setUmlError(
        'Analiz için önce Kaynaklar adımında sohbet/transkript verisini Laravel’e kaydedin, metin içeren dosya ekleyin veya oturum bağlamı oluşturun.',
      );
      return;
    }
    setUmlLoading(true);
    try {
      const res = await fetch(API_GENERATE_UML, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          text,
          type: project.diagramType === 'use_case' ? 'use_case' : 'class',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || `İstek başarısız (HTTP ${res.status})`);
      }
      const diagram = normalizeAiReactFlowPayload(data);
      if (!diagram) {
        throw new Error('Sunucudan geçerli nodes/edges alınamadı.');
      }
      onPatch({
        nodes: diagram.nodes,
        edges: diagram.edges,
        umlResult: JSON.stringify({ nodes: diagram.nodes, edges: diagram.edges }, null, 2),
      });
    } catch (e) {
      onPatch({ umlResult: '' });
      setUmlError(e instanceof Error ? e.message : 'Bilinmeyen hata');
    } finally {
      setUmlLoading(false);
    }
  }, [project, onPatch]);

  const handleGenerateSprintTasks = useCallback(async () => {
    setTasksError('');
    const diagram = slimDiagramForSprintTasks(nodes, edges);
    if (!diagram.nodes.length) {
      setTasksError('Önce tuvalde diyagram (en az bir düğüm) oluşturun veya güncelleyin.');
      return;
    }
    setTasksLoading(true);
    try {
      const res = await fetch(API_GENERATE_TASKS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ diagram }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || data.error || `İstek başarısız (HTTP ${res.status})`);
      }
      const raw = Array.isArray(data?.tasks) ? data.tasks : Array.isArray(data?.data) ? data.data : [];
      const normalized = normalizeApiSprintTasks(raw);
      if (!normalized.length) {
        throw new Error('Sunucudan görev listesi alınamadı.');
      }
      onPatch({ sprintTasks: normalized });
      showToast('Sprint görevleri oluşturuldu.', 'success');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Bilinmeyen hata';
      setTasksError(msg);
      showToast(msg, 'error');
    } finally {
      setTasksLoading(false);
    }
  }, [nodes, edges, onPatch, showToast]);

  const sprintTasks = useMemo(() => (Array.isArray(project.sprintTasks) ? project.sprintTasks : []), [project.sprintTasks]);

  const sprintGroups = useMemo(() => {
    const m = new Map();
    for (const t of sprintTasks) {
      const key = String(t.sprint_label || 'Sprint 1').trim() || 'Sprint 1';
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(t);
    }
    return [...m.entries()];
  }, [sprintTasks]);

  const toggleSprintTaskDone = useCallback(
    (taskId) => {
      const next = sprintTasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t));
      onPatch({ sprintTasks: next });
    },
    [sprintTasks, onPatch],
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {toast ? (
        <div
          role="status"
          className={`ses-toast pointer-events-none select-none ${toast.variant === 'success' ? 'ses-toast--success' : 'ses-toast--error'}`}
        >
          {toast.message}
        </div>
      ) : null}

      <header
        style={{
          padding: '12px 20px',
          borderBottom: '1px solid #334155',
          backgroundColor: '#1e293b',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid #334155',
            background: 'transparent',
            color: '#94a3b8',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          <ArrowLeft size={18} />
          Kaynaklara dön
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 200 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#f8fafc' }}>{project.name}</h2>
          <select
            value={project.diagramType === 'use_case' ? 'use_case' : 'class'}
            onChange={(e) => onPatch({ diagramType: e.target.value })}
            style={{
              backgroundColor: '#0f172a',
              color: '#94a3b8',
              border: '1px solid #334155',
              padding: '6px 10px',
              borderRadius: 6,
              fontSize: 12,
              outline: 'none',
            }}
          >
            <option value="class">Sınıf Diyagramı</option>
            <option value="use_case">Use Case</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => void handleExportPng()}
            disabled={exportPngLoading}
            style={{
              backgroundColor: 'transparent',
              color: '#94a3b8',
              border: '1px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: exportPngLoading ? 'wait' : 'pointer',
              fontSize: 12,
              opacity: exportPngLoading ? 0.75 : 1,
            }}
          >
            {exportPngLoading ? (
              <Loader2 size={14} className="ses-ai-spinner" aria-hidden />
            ) : (
              <Download size={14} />
            )}
            {exportPngLoading ? 'Dışa aktarılıyor…' : 'Dışa aktar (PNG)'}
          </button>
          <button
            type="button"
            onClick={handleGenerateUml}
            disabled={umlLoading}
            style={{
              backgroundColor: 'transparent',
              color: '#38bdf8',
              border: '1px solid #38bdf8',
              padding: '8px 14px',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: umlLoading ? 'wait' : 'pointer',
              fontSize: 12,
              opacity: umlLoading ? 0.7 : 1,
            }}
          >
            <RefreshCw size={14} /> {umlLoading ? 'Gönderiliyor…' : 'Güncelle / analiz et'}
          </button>
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div ref={flowMountRef} style={{ flex: 1, position: 'relative', backgroundColor: '#1e293b' }}>
          <div
            style={{
              position: 'absolute',
              top: 10,
              left: 0,
              right: 0,
              textAlign: 'center',
              zIndex: 5,
              color: '#64748b',
              fontSize: 11,
              letterSpacing: 1,
              fontWeight: 700,
              pointerEvents: 'none',
            }}
          >
            REACT FLOW TUVALİ
          </div>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            fitView
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{
              style: { stroke: '#64748b' },
              markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
            }}
          >
            <Background color="#334155" gap={16} size={1} />
            <Controls style={{ fill: '#0f172a' }} showInteractive={false} />
          </ReactFlow>
        </div>

        <aside
          style={{
            width: 300,
            flexShrink: 0,
            borderLeft: '1px solid #334155',
            backgroundColor: '#1e293b',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            overflow: 'auto',
          }}
        >
          <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', lineHeight: 1.45 }}>
            Analiz metni, Kaynaklar adımındaki dosyalar ile tarayıcıdaki oda / toplantı verisinden otomatik oluşturulur.
          </p>

          {umlError ? (
            <div style={{ fontSize: 12, color: '#f87171', lineHeight: 1.45 }}>{umlError}</div>
          ) : null}

          {project.umlResult ? (
            <div>
              <div style={{ fontSize: 11, color: '#10b981', fontWeight: 700, marginBottom: 6 }}>Diyagram JSON (API)</div>
              <pre
                style={{
                  margin: 0,
                  maxHeight: 200,
                  overflow: 'auto',
                  fontSize: 10,
                  lineHeight: 1.35,
                  color: '#cbd5e1',
                  backgroundColor: '#0f172a',
                  padding: 10,
                  borderRadius: 8,
                  border: '1px solid #334155',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {project.umlResult}
              </pre>
            </div>
          ) : null}

          <div style={{ borderTop: '1px solid #334155', paddingTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: '#10b981', fontWeight: 700 }}>Sprint görevleri</div>
              <button
                type="button"
                onClick={handleGenerateSprintTasks}
                disabled={tasksLoading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: '1px solid #334155',
                  background: tasksLoading ? '#334155' : '#0f172a',
                  color: '#e2e8f0',
                  cursor: tasksLoading ? 'not-allowed' : 'pointer',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {tasksLoading ? <Loader2 size={14} className="ses-ai-spinner" aria-hidden /> : <RefreshCw size={14} />}
                Üret
              </button>
            </div>
            {tasksError ? <div style={{ fontSize: 12, color: '#f87171', marginBottom: 10, lineHeight: 1.45 }}>{tasksError}</div> : null}
            {sprintGroups.length === 0 ? (
              <p style={{ margin: 0, fontSize: 12, color: '#64748b', lineHeight: 1.45 }}>
                Tuvaldeki diyagrama göre görev üretmek için «Üret»e tıklayın. Liste projede saklanır.
              </p>
            ) : (
              sprintGroups.map(([label, groupTasks]) => (
                <div key={label} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 8 }}>{label}</div>
                  {groupTasks.map((t) => (
                    <SprintTaskRow key={t.id} task={t} onToggleDone={() => toggleSprintTaskDone(t.id)} />
                  ))}
                </div>
              ))
            )}
          </div>

          <div
            style={{
              marginTop: 'auto',
              paddingTop: 12,
              fontSize: 11,
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <UserCircle size={22} color="#94a3b8" />
            <span>Yapay zeka, sol paneldeki verileri okuyup şemayı tuvalde güncelleyebilir.</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

function SprintTaskRow({ task, onToggleDone }) {
  const subParts = [
    task.description,
    task.priority ? `Öncelik: ${task.priority}` : '',
    task.area ? `Alan: ${task.area}` : '',
  ].filter(Boolean);
  const sub = subParts.join(' · ');
  return (
    <label
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        marginBottom: 12,
        cursor: 'pointer',
      }}
    >
      <input
        type="checkbox"
        checked={!!task.done}
        onChange={onToggleDone}
        style={{ marginTop: 4, accentColor: '#10b981' }}
      />
      <span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#e2e8f0' }}>
          <FileText size={14} color="#94a3b8" />
          {task.title}
        </span>
        {sub ? <span style={{ display: 'block', fontSize: 11, color: '#64748b', marginTop: 4 }}>{sub}</span> : null}
      </span>
    </label>
  );
}
