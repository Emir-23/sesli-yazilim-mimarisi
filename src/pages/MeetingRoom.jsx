import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function MeetingRoom() {
  const navigate = useNavigate();

  return (
    <div style={{ height: '100vh', backgroundColor: '#0f172a', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <h2>🎙️ Canlı Toplantı Odası</h2>
      <p style={{ color: '#94a3b8', marginBottom: '20px' }}>Bu ekran ileride geliştirilecektir.</p>
      
      <button onClick={() => navigate('/uml')} style={{ backgroundColor: '#ef4444', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
        Odadan Ayrıl ve Projeye Dön
      </button>
    </div>
  );
}