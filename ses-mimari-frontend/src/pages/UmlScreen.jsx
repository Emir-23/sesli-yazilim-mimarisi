import React from 'react';
import { Activity, UserCircle, ArrowLeft, ShoppingCart, PlusSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DiagramGenerator from '../components/DiagramGenerator';

export default function UmlScreen() {
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#0f172a', color: '#e2e8f0', fontFamily: 'sans-serif' }}>
      
      {/* EN ÜST BAR (Logo ve Profil) */}
      <div style={{ height: '60px', backgroundColor: '#1e293b', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Activity size={24} color="#10b981" />
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '16px' }}>SesMimari AI</div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>UML Asistanı</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#94a3b8' }}>
          <UserCircle size={28} color="#e2e8f0" />
        
          <span style={{ fontSize: '14px', color: '#e2e8f0' }}>Hüseyin Altıparmak <span style={{ color: '#64748b' }}></span></span>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* SOL MENÜ (Sidebar) */}
        <div style={{ width: '260px', backgroundColor: '#1e293b', padding: '15px', borderRight: '1px solid #334155', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <div onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', marginBottom: '30px', cursor: 'pointer', color: '#94a3b8', border: '1px solid #334155', padding: '5px 10px', borderRadius: '4px', width: 'fit-content' }}>
            <ArrowLeft size={16} style={{ marginRight: '5px' }}/>
            <span style={{ fontSize: '12px' }}>Geri Dön</span>
          </div>
          
          <h3 style={{ fontSize: '15px', marginBottom: '15px', fontWeight: '500', color: '#f8fafc' }}>Geçmiş Analiz Projeleriniz</h3>
          
          <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', marginBottom: '10px', border: '1px solid #334155', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
              <Activity size={16} style={{ marginRight: '8px', color: '#94a3b8' }} />
              <strong style={{ fontSize: '13px', color: '#f8fafc' }}>Öğrenci Sistemi (OBS)</strong>
            </div>
            <div style={{ fontSize: '10px', color: '#64748b', marginLeft: '24px' }}>Diyagram: Sınıf / Oluşturulma: 12 Mart</div>
          </div>

          <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', marginBottom: '10px', border: '1px solid #334155', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
              <ShoppingCart size={16} style={{ marginRight: '8px', color: '#f59e0b' }} />
              <strong style={{ fontSize: '13px', color: '#f8fafc' }}>E-Ticaret Altyapısı</strong>
            </div>
            <div style={{ fontSize: '10px', color: '#64748b', marginLeft: '24px' }}>E-Com Diyagram: Use Case / Oluşturulma: 10 Mart</div>
          </div>

          <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', border: '1px solid #334155', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
              <PlusSquare size={16} style={{ marginRight: '8px', color: '#ef4444' }} />
              <strong style={{ fontSize: '13px', color: '#f8fafc' }}>Hastane Otomasyonu</strong>
            </div>
            <div style={{ fontSize: '10px', color: '#64748b', marginLeft: '24px' }}>Diyagram: Sınıf / Oluşturulma: 5 Mart</div>
          </div>
        </div>

        {/* SAĞ TARAF */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#0f172a' }}>
          <DiagramGenerator />
        </div>
      </div>
    </div>
  );
}