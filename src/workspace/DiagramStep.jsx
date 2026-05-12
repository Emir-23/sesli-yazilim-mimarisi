import { useCallback, useMemo, useState } from 'react';
import ReactFlow, { Background, Controls, MiniMap, applyEdgeChanges, applyNodeChanges } from 'reactflow';
import 'reactflow/dist/style.css';
import {
  ArrowLeft,
  Download,
  FileText,
  RefreshCw,
  UserCircle,
} from 'lucide-react';
import { API_GENERATE_UML } from './constants';

export default function DiagramStep({ project, onBack, onPatch }) {
  const [umlLoading, setUmlLoading] = useState(false);
  const [umlError, setUmlError] = useState('');

  const nodes = useMemo(() => project.nodes ?? [], [project.nodes]);
  const edges = useMemo(() => project.edges ?? [], [project.edges]);

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

  const handleGenerateUml = useCallback(async () => {
    setUmlError('');
    setUmlLoading(true);
    try {
      const res = await fetch(API_GENERATE_UML, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ text: project.meetingText ?? '' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || `İstek başarısız (HTTP ${res.status})`);
      }
      if (typeof data.uml !== 'string') {
        throw new Error('Sunucudan geçersiz yanıt alındı.');
      }
      onPatch({ umlResult: data.uml });
    } catch (e) {
      onPatch({ umlResult: '' });
      setUmlError(e instanceof Error ? e.message : 'Bilinmeyen hata');
    } finally {
      setUmlLoading(false);
    }
  }, [project.meetingText, onPatch]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
            value={project.diagramLabel || 'Sınıf Diyagramı'}
            onChange={(e) => onPatch({ diagramLabel: e.target.value })}
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
            <option>Sınıf Diyagramı</option>
            <option>Use Case</option>
            <option>Sekans</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            style={{
              backgroundColor: 'transparent',
              color: '#94a3b8',
              border: '1px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            <Download size={14} /> Dışa aktar
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
        <div style={{ flex: 1, position: 'relative', backgroundColor: '#1e293b' }}>
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
          >
            <Background color="#334155" gap={16} size={1} />
            <Controls style={{ fill: '#0f172a' }} showInteractive={false} />
            <MiniMap
              nodeColor="#10b981"
              maskColor="rgba(15, 23, 42, 0.85)"
              style={{ backgroundColor: '#0f172a' }}
            />
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
          <div>
            <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>
              Toplantı metni
            </label>
            <textarea
              value={project.meetingText ?? ''}
              onChange={(e) => onPatch({ meetingText: e.target.value })}
              placeholder="Örn: Kütüphane sisteminde Kitap ve Yazar sınıfları…"
              style={{
                width: '100%',
                minHeight: 100,
                padding: 10,
                fontSize: 12,
                backgroundColor: '#0f172a',
                color: '#e2e8f0',
                border: '1px solid #334155',
                borderRadius: 8,
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {umlError ? (
            <div style={{ fontSize: 12, color: '#f87171', lineHeight: 1.45 }}>{umlError}</div>
          ) : null}

          {project.umlResult ? (
            <div>
              <div style={{ fontSize: 11, color: '#10b981', fontWeight: 700, marginBottom: 6 }}>PlantUML (API)</div>
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
            <div style={{ fontSize: 12, color: '#10b981', fontWeight: 700, marginBottom: 10 }}>Sprint görevleri</div>
            <Task
              title="Laravel migration'ları hazırlanacak"
              sub="Şema ile uyumlu ilk migrasyon seti"
            />
            <Task title="Deepgram API entegrasyonu" sub="Ses → metin boru hattı" />
            <Task title="Socket.io oturumu" sub="Canlı oda için gerçek zamanlı kanal" />
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
            <span>
              Yapay zeka, sol paneldeki verileri okuyup şemayı tuvalde güncelleyebilir.
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Task({ title, sub }) {
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
      <input type="checkbox" style={{ marginTop: 4, accentColor: '#10b981' }} />
      <span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#e2e8f0' }}>
          <FileText size={14} color="#94a3b8" />
          {title}
        </span>
        <span style={{ display: 'block', fontSize: 11, color: '#64748b', marginTop: 4 }}>{sub}</span>
      </span>
    </label>
  );
}
