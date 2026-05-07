import React, { useCallback, useEffect, useState } from 'react';
import ReactFlow, { Background, Controls, applyEdgeChanges, applyNodeChanges } from 'reactflow';
import 'reactflow/dist/style.css';
import { Download, Loader2 } from 'lucide-react';

const API_GENERATE_UML = 'http://127.0.0.1:8000/api/generate-uml';
const API_GENERATE_TASKS = 'http://127.0.0.1:8000/api/generate-tasks';

const initialNodes = [
  { id: '1', position: { x: 50, y: 50 }, data: { label: 'AuthClass' }, style: { backgroundColor: '#1e293b', color: '#e2e8f0', border: '1px solid #10b981', borderRadius: '4px', padding: '10px', fontSize: '12px' } },
  { id: '2', position: { x: 250, y: 50 }, data: { label: 'UserClass' }, style: { backgroundColor: '#1e293b', color: '#e2e8f0', border: '1px solid #10b981', borderRadius: '4px', padding: '10px', fontSize: '12px' } },
  { id: '3', position: { x: 50, y: 150 }, data: { label: 'Session' }, style: { backgroundColor: '#1e293b', color: '#e2e8f0', border: '1px solid #10b981', borderRadius: '4px', padding: '10px', fontSize: '12px' } },
  { id: '4', position: { x: 250, y: 150 }, data: { label: 'Project' }, style: { backgroundColor: '#1e293b', color: '#e2e8f0', border: '1px solid #10b981', borderRadius: '4px', padding: '10px', fontSize: '12px' } },
];

const initialEdges = [
  { id: 'e1-2', source: '1', target: '2', label: '1:1', style: { stroke: '#94a3b8' } },
  { id: 'e1-3', source: '1', target: '3', label: '1:*', style: { stroke: '#94a3b8' } },
  { id: 'e2-4', source: '2', target: '4', label: '1:1', style: { stroke: '#94a3b8' } },
];

export default function DiagramGenerator({ projectId = '1' }) {
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState('');
  const [umlError, setUmlError] = useState('');
  const [autoGenerateTasks, setAutoGenerateTasks] = useState(false);
  const [diagramType, setDiagramType] = useState('class');
  const [umlLoading, setUmlLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [meetingText, setMeetingText] = useState('');

  const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);

  const applyBottleneckHighlight = useCallback((incomingNodes = [], incomingEdges = []) => {
    const degreeMap = new Map();

    incomingEdges.forEach((edge) => {
      if (edge?.source) {
        degreeMap.set(edge.source, (degreeMap.get(edge.source) || 0) + 1);
      }
      if (edge?.target) {
        degreeMap.set(edge.target, (degreeMap.get(edge.target) || 0) + 1);
      }
    });

    return incomingNodes.map((node) => {
      const connectionCount = degreeMap.get(node.id) || 0;
      const isBottleneck = connectionCount >= 4;

      return {
        ...node,
        style: {
          ...(node.style || {}),
          border: isBottleneck ? '3px solid #FF8C00' : ((node.style && node.style.border) || '1px solid #10b981'),
          boxShadow: isBottleneck ? '0 0 0 1px rgba(255,140,0,0.25), 0 0 10px rgba(255,140,0,0.35)' : (node.style && node.style.boxShadow),
        },
      };
    });
  }, []);

  const showToast = useCallback((message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem(`meeting:${projectId}`);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      const composed = [parsed.notes, parsed.messages].filter(Boolean).join('\n');
      if (composed.trim()) setMeetingText(composed);
    } catch (error) {
      console.error('Meeting verisi okunamadi:', error);
    }
  }, [projectId]);

  const generateTasks = useCallback(async ({ silent = false } = {}) => {
    const text = (meetingText || '').trim();
    if (!text) {
      if (!silent) showToast('Görev üretmek için önce toplantı metni gir.', 'error');
      return;
    }

    setTasksLoading(true);
    setTasksError('');

    try {
      const response = await fetch(API_GENERATE_TASKS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(text ? { text } : { project_id: Number(projectId) || 1 }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || `Istek basarisiz (HTTP ${response.status})`);
      }

      const list = Array.isArray(data?.tasks) ? data.tasks : Array.isArray(data?.data) ? data.data : [];
      setTasks(list);

      if (!silent) {
        showToast(list.length ? 'Görevler üretildi!' : 'Görev bulunamadı. Metni biraz daha detaylandır.', list.length ? 'success' : 'error');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bilinmeyen hata';
      setTasksError(message);
      if (!silent) showToast(message, 'error');
    } finally {
      setTasksLoading(false);
    }
  }, [meetingText, projectId, showToast]);

  const handleGenerate = async () => {
    const text = (meetingText || '').trim();
    if (!text) {
      setUmlError('Diyagram üretmeden önce toplantı metni girmen gerekiyor.');
      showToast('Boş metin ile UML üretilemez.', 'error');
      return;
    }

    setUmlLoading(true);
    setToast(null);
    setUmlError('');

    try {
      const response = await fetch(API_GENERATE_UML, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ text, type: diagramType }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || `Istek basarisiz (HTTP ${response.status})`);
      }

      if (data.nodes && data.edges) {
        const highlightedNodes = applyBottleneckHighlight(data.nodes, data.edges);
        setNodes(highlightedNodes);
        setEdges(data.edges);
      }
      if (data.nodes || data.diagram_data) {
        showToast('Diyagram başarıyla oluşturuldu!', 'success');
      }

      // Sadece kullanıcı açıkça isterse diyagramla birlikte görev üret.
      if (autoGenerateTasks) {
        generateTasks({ silent: true });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bilinmeyen hata';
      setUmlError(message);
      showToast(message, 'error');
    } finally {
      setUmlLoading(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
      
      {/* Toast Uyarı Kutusu */}
      {toast && (
        <div style={{
          position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)', zIndex: 100, 
          padding: '10px 20px', borderRadius: '6px', color: 'white', fontWeight: 'bold', fontSize: '13px',
          backgroundColor: toast.type === 'error' ? '#ef4444' : '#10b981', boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}>
          {toast.message}
        </div>
      )}

      <div style={{ padding: '12px 20px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e293b' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <h2 style={{ margin: 0, fontSize: '14px', fontWeight: '500', color: '#f8fafc' }}>React Flow Tuvali</h2>
          <select 
            value={diagramType} 
            onChange={(e) => setDiagramType(e.target.value)}
            disabled={umlLoading}
            style={{ backgroundColor: '#0f172a', color: '#94a3b8', border: '1px solid #334155', padding: '6px 8px', borderRadius: '4px', outline: 'none', fontSize: '12px' }}
          >
            <option value="class">[ Sınıf Diyagramı ]</option>
            <option value="state">[ Durum Diyagramı ]</option>
          </select>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '11px',
              color: '#cbd5e1',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={autoGenerateTasks}
              onChange={(e) => setAutoGenerateTasks(e.target.checked)}
              style={{ accentColor: '#10b981', cursor: 'pointer' }}
            />
            Diyagramla birlikte görevleri de üret
          </label>
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleGenerate} 
            disabled={umlLoading}
            style={{ backgroundColor: umlLoading ? '#475569' : '#10b981', color: 'white', border: 'none', padding: '6px 15px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px', cursor: umlLoading ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold' }}
          >
            {umlLoading ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Üretiliyor...</> : '⚡ DİYAGRAM OLUŞTUR'}
          </button>

          <button
            onClick={() => generateTasks({ silent: false })}
            disabled={tasksLoading}
            style={{
              backgroundColor: tasksLoading ? '#475569' : '#0f172a',
              color: '#38bdf8',
              border: '1px solid #334155',
              padding: '6px 12px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: tasksLoading ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: 'bold',
            }}
            title="Sprint görevlerini üret"
          >
            {tasksLoading ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Görevler...</> : '🧩 GÖREVLERİ ÜRET'}
          </button>
          
          <button style={{ backgroundColor: 'transparent', color: '#94a3b8', border: '1px solid transparent', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px' }}>
            <Download size={14} /> Dışa Aktar (PNG/JSON)
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', padding: '15px', gap: '15px', overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <label style={{ fontSize: '11px', color: '#94a3b8' }}>Toplantı metni</label>
          <textarea
            value={meetingText}
            onChange={(e) => setMeetingText(e.target.value)}
            placeholder="Orn: Kutuphane sisteminde Kitap ve Yazar siniflari..."
            style={{
              width: '100%', minHeight: '90px',
              padding: '8px',
              fontSize: '11px',
              backgroundColor: '#0f172a',
              color: '#e2e8f0',
              border: '1px solid #334155',
              borderRadius: '4px',
              resize: 'vertical',
            }}
          />
          <div style={{ flex: 1, backgroundColor: '#1e293b', borderRadius: '6px', border: '1px solid #334155', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 10, width: '100%', textAlign: 'center', zIndex: 10, color: '#94a3b8', fontSize: '11px', letterSpacing: '1px', fontWeight: 'bold' }}>REACT FLOW TUVALİ</div>
          <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} fitView>
            <Background color="#2a2a2a" gap={16} size={1} />
            <Controls style={{ fill: 'white' }} showInteractive={false} />
          </ReactFlow>
        </div>
        </div>
        <div style={{ width: '290px', backgroundColor: '#1e293b', borderRadius: '6px', border: '1px solid #334155', padding: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {umlError ? (
            <div style={{ fontSize: '11px', color: '#f87171', marginBottom: '10px', lineHeight: 1.4 }}>{umlError}</div>
          ) : null}
          <div style={{ fontSize: '12px', color: '#10b981', fontWeight: 'bold', marginBottom: '10px' }}>
            Sprint Görevleri
          </div>
          {tasksLoading ? (
            <div style={{ fontSize: '12px', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              Görevler çıkarılıyor...
            </div>
          ) : null}
          {tasksError ? (
            <div style={{ fontSize: '11px', color: '#f87171', lineHeight: 1.4, marginBottom: '8px' }}>{tasksError}</div>
          ) : null}
          <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #334155', borderRadius: '6px', padding: '10px', backgroundColor: '#0f172a' }}>
            {tasks.length === 0 && !tasksLoading ? (
              <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>
                Henüz görev yok. "Görevleri Üret" butonunu kullan.
              </div>
            ) : tasks.map((t, idx) => (
              <div key={`${t.task_name || 'task'}-${idx}`} style={{ border: '1px solid #334155', borderRadius: '8px', padding: '10px', marginBottom: '10px', backgroundColor: '#111827' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#f8fafc', marginBottom: '6px' }}>
                  {t.task_name || `Görev ${idx + 1}`}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.45 }}>
                  {t.description || 'Açıklama yok.'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .react-flow__attribution, .react-flow__attribution a {
          color: #64748b !important;
          font-size: 9px;
          text-decoration: none;
        }
      `}</style>
    </div>
  );
}