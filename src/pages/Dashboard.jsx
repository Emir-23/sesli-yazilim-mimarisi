import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Folder } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <div style={{ height: '100vh', backgroundColor: '#0f172a', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <h1 style={{ fontSize: '32px', marginBottom: '10px' }}>Sisteme Hoş Geldiniz.</h1>
      <p style={{ color: '#94a3b8', marginBottom: '40px' }}>Ne yapmak istersiniz?</p>

      <div style={{ display: 'flex', gap: '20px' }}>
        {/* UML Sayfasına Yönlendiren Buton */}
        <button 
          onClick={() => navigate('/uml')}
          style={{ width: '250px', height: '150px', backgroundColor: '#1e293b', border: '1px solid #10b981', borderRadius: '12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#10b981', transition: '0.3s' }}
        >
          <Plus size={48} style={{ marginBottom: '15px' }} />
          <span style={{ fontSize: '16px', fontWeight: 'bold' }}>YENİ PROJE BAŞLAT</span>
        </button>

        <button style={{ width: '250px', height: '150px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
          <Folder size={48} style={{ marginBottom: '15px', color: '#f59e0b' }} />
          <span style={{ fontSize: '16px', fontWeight: 'bold' }}>ESKİ PROJELERİ GÖRÜNTÜLÜ</span>
        </button>
      </div>
    </div>
  );
}