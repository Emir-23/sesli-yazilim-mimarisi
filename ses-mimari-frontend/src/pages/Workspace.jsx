import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import DiagramGenerator from '../components/DiagramGenerator';

export default function Workspace() {
  const { id } = useParams();
  const navigate = useNavigate();
  const projectId = id || '1';

  return (
    <div style={{ height: '100vh', backgroundColor: '#0f172a', color: '#e2e8f0', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #334155', backgroundColor: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => navigate(`/meeting/${projectId}`)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <ArrowLeft size={16} style={{ marginRight: '6px' }} /> Veri Toplama Odasına Dön
        </button>
        <div style={{ fontSize: '13px', color: '#cbd5e1' }}>Sonuç ve Analiz Ekranı (#{projectId})</div>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <DiagramGenerator projectId={projectId} />
      </div>
    </div>
  );
}

