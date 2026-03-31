import React, { useState, useCallback } from 'react';
import ReactFlow, { MiniMap, Controls, Background, applyNodeChanges, applyEdgeChanges } from 'reactflow';
import 'reactflow/dist/style.css';
import { Folder, Mic, ArrowLeft, Download, RefreshCw, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom'; // Sayfa değiştirmek için eklendi

const initialNodes = [
  { id: '1', position: { x: 100, y: 50 }, data: { label: 'AuthClass' }, style: { backgroundColor: '#0f172a', color: 'white', border: '1px solid #10b981', borderRadius: '5px', padding: '10px' } },
  { id: '2', position: { x: 300, y: 50 }, data: { label: 'UserClass' }, style: { backgroundColor: '#0f172a', color: 'white', border: '1px solid #10b981', borderRadius: '5px', padding: '10px' } },
];
const initialEdges = [
  { id: 'e1-2', source: '1', target: '2', animated: true, label: '1:1', style: { stroke: '#10b981' } },
];

export default function UmlScreen() {
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);
  const navigate = useNavigate(); // Geri dön butonu için

  const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#0f172a', color: '#e2e8f0', fontFamily: 'sans-serif' }}>
      
      {/* SOL MENÜ */}
      <div style={{ width: '260px', backgroundColor: '#1e293b', padding: '20px', borderRight: '1px solid #334155' }}>
        {/* GERİ DÖN BUTONU */}
        <div onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', marginBottom: '40px', cursor: 'pointer', color: '#94a3b8' }}>
           <ArrowLeft size={18} style={{ marginRight: '10px' }}/>
           <span style={{ fontSize: '14px' }}>Ana Sayfaya Dön</span>
        </div>
        <h3 style={{ color: '#e2e8f0', fontSize: '16px', marginBottom: '20px', fontWeight: 'normal' }}>Geçmiş Projeler</h3>
        <div style={{ backgroundColor: '#0f172a', padding: '15px', borderRadius: '8px', border: '1px solid #334155' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Folder size={18} style={{ marginRight: '10px', color: '#94a3b8' }} />
            <strong style={{ fontSize: '14px' }}>Öğrenci Sistemi (OBS)</strong>
          </div>
        </div>
      </div>

      {/* SAĞ TARAF - ANA İÇERİK */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Üst Bar */}
        <div style={{ padding: '15px 20px', borderBottom: '1px solid #334155', backgroundColor: '#1e293b', display: 'flex', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 'normal' }}>Proje: Öğrenci Bilgi Sistemi</h2>
          <button style={{ backgroundColor: 'transparent', color: '#38bdf8', border: '1px solid #38bdf8', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer' }}>
             GÜNCELLE / ANALİZ ET
          </button>
        </div>

        {/* Çalışma Alanı */}
        <div style={{ flex: 1, display: 'flex', padding: '20px', gap: '20px' }}>
            {/* React Flow Tuvali */}
            <div style={{ flex: 1, backgroundColor: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }}>
                <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} fitView>
                    <Background color="#334155" gap={16} />
                    <Controls style={{ backgroundColor: '#0f172a', fill: 'white' }} />
                    <MiniMap nodeColor="#10b981" maskColor="rgba(15, 23, 42, 0.8)" style={{ backgroundColor: '#0f172a' }} />
                </ReactFlow>
            </div>
            {/* Sağ Menü - Toplantıya Git Butonu eklendi */}
            <div style={{ width: '240px', backgroundColor: '#1e293b', borderRadius: '8px', border: '1px solid #334155', padding: '15px' }}>
                 <button onClick={() => navigate('/meeting')} style={{ width: '100%', backgroundColor: '#10b981', color: 'white', padding: '10px', border: 'none', borderRadius: '6px', cursor: 'pointer', marginBottom: '15px' }}>
                    🎙️ Toplantı Odasına Git
                 </button>
                 <div style={{ fontSize: '12px', color: '#10b981', fontWeight: 'bold' }}>Sprint Görevleri</div>
            </div>
        </div>
      </div>
    </div>
  );
}