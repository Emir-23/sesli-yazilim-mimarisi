import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const pastProjects = [
    { id: '1001', name: 'Öğrenci Bilgi Sistemi' },
    { id: '1002', name: 'E-Ticaret Altyapısı' },
    { id: '1003', name: 'Hastane Otomasyonu' },
  ];

  const handleStartProject = () => {
    const projectId = String(Date.now());
    navigate(`/meeting/${projectId}`);
  };

  return (
    <div style={{ height: '100vh', backgroundColor: '#0f172a', color: 'white', display: 'flex' }}>
      <aside style={{ width: '280px', borderRight: '1px solid #334155', padding: '20px', backgroundColor: '#111827' }}>
        <h3 style={{ marginTop: 0, marginBottom: '14px', color: '#e2e8f0' }}>Geçmiş Projeler</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {pastProjects.map((project) => (
            <button
              key={project.id}
              onClick={() => navigate(`/meeting/${project.id}`)}
              style={{ textAlign: 'left', backgroundColor: '#1e293b', color: '#cbd5e1', border: '1px solid #334155', borderRadius: '8px', padding: '10px', cursor: 'pointer' }}
            >
              {project.name}
            </button>
          ))}
        </div>
      </aside>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <button
          onClick={handleStartProject}
          style={{ width: '280px', height: '160px', backgroundColor: '#1e293b', border: '1px solid #10b981', borderRadius: '12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}
        >
          <Plus size={44} style={{ marginBottom: '10px' }} />
          <span style={{ fontSize: '16px', fontWeight: 'bold' }}>YENİ PROJE BAŞLAT</span>
        </button>
      </div>
    </div>
  );
}