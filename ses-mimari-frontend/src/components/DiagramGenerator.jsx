import React, { useState, useCallback, useRef } from 'react';
import ReactFlow, { Background, Controls, applyNodeChanges, applyEdgeChanges } from 'reactflow';
import 'reactflow/dist/style.css';
import { Download, RefreshCw, Upload, Mic, FileText, Loader2, X } from 'lucide-react';

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

export default function DiagramGenerator() {
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);
  
  const [diagramType, setDiagramType] = useState('class');
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const fileInputRef = useRef(null);
  
  // Dosya Önizleme Modal'ı için state
  const [previewModal, setPreviewModal] = useState(null);

  const [uploadedFiles, setUploadedFiles] = useState([
    { id: 1, name: '12 Mart Gereksinim.txt', type: 'txt', originalFile: null },
    { id: 2, name: '15 Mart SesKaydi.mp3', type: 'mp3', originalFile: null },
    { id: 3, name: '20 Mart CanlıToplantı.txt', type: 'txt', originalFile: null }
  ]);

  const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);

  const showToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const isMp3 = file.name.toLowerCase().endsWith('.mp3');
    
    const newFile = {
      id: Date.now(),
      name: file.name,
      type: isMp3 ? 'mp3' : 'txt',
      originalFile: file // Dosyanın orijinal halini saklıyoruz ki okuyabilelim
    };

    setUploadedFiles((prevFiles) => [newFile, ...prevFiles]);
    showToast(`${file.name} eklendi! Backend'e göndermek için hazır.`, 'success');
    e.target.value = null;
  };

  const openFile = (fileObj) => {
    if (!fileObj.originalFile) {
      showToast("Bu örnek bir dosya hacım, gerçeğini yükle ki açayım!", "error");
      return;
    }

    if (fileObj.type === 'txt') {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewModal({
          type: 'txt',
          name: fileObj.name,
          content: e.target.result
        });
      };
      reader.readAsText(fileObj.originalFile);
    } 
    else if (fileObj.type === 'mp3') {
      const audioUrl = URL.createObjectURL(fileObj.originalFile);
      setPreviewModal({
        type: 'mp3',
        name: fileObj.name,
        content: audioUrl
      });
    }
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setToast(null);

    try {
      const response = await fetch('/api/generate-uml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: diagramType }),
      });

      if (!response.ok) throw new Error('Sunucular yoğun, biraz bekleyip tekrar dene.');

      const data = await response.json();
      if (data.nodes && data.edges) {
        setNodes(data.nodes);
        setEdges(data.edges);
        showToast('Diyagram başarıyla oluşturuldu!', 'success');
      }
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setIsLoading(false);
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

      {/* MODAL (DOSYA ÖNİZLEME PENCERESİ) */}
      {previewModal && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
          backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', 
          justifyContent: 'center', alignItems: 'center'
        }}>
          <div style={{
            backgroundColor: '#1e293b', width: '500px', maxHeight: '80%', 
            borderRadius: '8px', border: '1px solid #334155', display: 'flex', flexDirection: 'column',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
          }}>
            {/* Modal Üst Bar */}
            <div style={{ padding: '15px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#e2e8f0', fontWeight: 'bold' }}>
                {previewModal.type === 'mp3' ? <Mic size={18} color="#a855f7" /> : <FileText size={18} color="#38bdf8" />}
                {previewModal.name}
              </div>
              <button 
                onClick={() => setPreviewModal(null)} 
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Modal İçerik */}
            <div style={{ padding: '20px', overflowY: 'auto', color: '#cbd5e1', fontSize: '14px', lineHeight: '1.6' }}>
              {previewModal.type === 'txt' ? (
                <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>
                  {previewModal.content}
                </pre>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
                  <audio controls src={previewModal.content} style={{ width: '100%' }} autoPlay />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Proje Başlık Barı */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e293b' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <h2 style={{ margin: 0, fontSize: '14px', fontWeight: '500', color: '#f8fafc' }}>Proje: Öğrenci Bilgi Sistemi (OBS)</h2>
          <select 
            value={diagramType} 
            onChange={(e) => setDiagramType(e.target.value)}
            disabled={isLoading}
            style={{ backgroundColor: '#0f172a', color: '#94a3b8', border: '1px solid #334155', padding: '6px 8px', borderRadius: '4px', outline: 'none', fontSize: '12px' }}
          >
            <option value="class">[ Sınıf Diyagramı ]</option>
            <option value="state">[ Durum Diyagramı ]</option>
          </select>
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={handleGenerate} 
            disabled={isLoading}
            style={{ backgroundColor: isLoading ? '#475569' : '#10b981', color: 'white', border: 'none', padding: '6px 15px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px', cursor: isLoading ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold' }}
          >
            {isLoading ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Üretiliyor...</> : '⚡ DİYAGRAM OLUŞTUR'}
          </button>
          
          <button style={{ backgroundColor: 'transparent', color: '#94a3b8', border: '1px solid transparent', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px' }}>
            <Download size={14} /> Dışa Aktar (PNG/JSON)
          </button>
        </div>
      </div>

      {/* 3 Kolonlu Çalışma Alanı */}
      <div style={{ flex: 1, display: 'flex', padding: '15px', gap: '15px', overflow: 'hidden' }}>
        
        {/* 1. KOLON: ZAMAN ÇİZELGESİ */}
        <div style={{ width: '220px', backgroundColor: '#1e293b', borderRadius: '6px', border: '1px solid #334155', padding: '12px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '11px', textAlign: 'center', color: '#94a3b8', letterSpacing: '1px', marginBottom: '15px', fontWeight: 'bold' }}>ZAMAN ÇİZELGESİ</div>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            accept=".txt,.mp3" 
            onChange={handleFileUpload} 
          />
          
          <button 
            onClick={() => fileInputRef.current.click()}
            style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '8px', borderRadius: '4px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', cursor: 'pointer', marginBottom: '8px', fontSize: '12px' }}
          >
            <Upload size={14}/> Dosya Yükle (.txt/.mp3)
          </button>
          
          <button style={{ backgroundColor: '#1e293b', color: '#10b981', border: '1px solid #10b981', padding: '8px', borderRadius: '4px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px' }}>
            <Mic size={14}/> Canlı Oda Başlat
          </button>
          
          {/* DİNAMİK VE TIKLANABİLİR LİSTE ALANI */}
          <div style={{ marginTop: '20px', fontSize: '12px', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
            {uploadedFiles.map((file) => (
              <div 
                key={file.id} 
                onClick={() => openFile(file)} 
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#334155'; e.currentTarget.style.color = '#38bdf8'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#cbd5e1'; }}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '6px', 
                  borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' 
                }}
                title="Açmak için tıkla"
              >
                {file.type === 'mp3' ? (
                  <Mic size={14} color="#a855f7" style={{ flexShrink: 0 }}/>
                ) : (
                  <FileText size={14} color="#94a3b8" style={{ flexShrink: 0 }}/>
                )}
                <span style={{ textDecoration: file.originalFile ? 'underline' : 'none' }}>
                  {file.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 2. KOLON: REACT FLOW TUVALİ */}
        <div style={{ flex: 1, backgroundColor: '#1e293b', borderRadius: '6px', border: '1px solid #334155', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 10, width: '100%', textAlign: 'center', zIndex: 10, color: '#94a3b8', fontSize: '11px', letterSpacing: '1px', fontWeight: 'bold' }}>REACT FLOW TUVALİ</div>
          <div style={{ position: 'absolute', bottom: 20, right: 20, zIndex: 10, color: '#bebec3', fontSize: '12px', maxWidth: '200px', textAlign: 'right', opacity: 0.8 }}>
            Yapay Zeka, sol paneldeki verileri okuyup şemayı buraya çizer.
          </div>
          <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} fitView>
            {/* HARBİ HARBİ BEYAZLARI DÜZELTTİK: Arka plan noktalarını temanın koyu grisine çektik */}
            <Background color="#2a2a2a" gap={16} size={1} />
            <Controls style={{ fill: 'white' }} showInteractive={false} />
          </ReactFlow>
        </div>

        {/* 3. KOLON: SPRINT GÖREVLERİ */}
        <div style={{ width: '240px', backgroundColor: '#1e293b', borderRadius: '6px', border: '1px solid #334155', padding: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>
            <span style={{ fontSize: '11px', color: '#64748b', cursor: 'pointer' }}>TAB: [Canlı Chat]</span>
            <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 'bold', cursor: 'pointer' }}>TAB: [■ Sprint Görevleri]</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '12px' }}>
            <input type="checkbox" style={{ marginTop: '3px', accentColor: '#10b981' }} />
            <div>
              <div style={{ fontSize: '12px', color: '#e2e8f0' }}>Laravel Migration'ları</div>
              <div style={{ fontSize: '10px', color: '#64748b' }}>Migration hangisine edilecek</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '12px' }}>
            <input type="checkbox" style={{ marginTop: '3px', accentColor: '#10b981' }} />
            <div>
              <div style={{ fontSize: '12px', color: '#e2e8f0' }}>Deepgram API</div>
              <div style={{ fontSize: '10px', color: '#64748b' }}>API entegre edilecek</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <input type="checkbox" style={{ marginTop: '3px', accentColor: '#10b981' }} />
            <div>
              <div style={{ fontSize: '12px', color: '#e2e8f0' }}>Socket.io Entegrasyonu</div>
              <div style={{ fontSize: '10px', color: '#64748b' }}>Post entegre edilecek</div>
            </div>
          </div>
        </div>

      </div>
      
      {/* CSS Animasyonu ve HARBİ HARBİ BEYAZLARI DÜZELTTİK: Sol alttaki attribution metnini soluk gri yaptık */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        /* React Flow sol alt köşedeki logonun metnini soluk gri yapar */
        .react-flow__attribution, .react-flow__attribution a {
          color: #64748b !important; 
          font-size: 9px;
          text-decoration: none;
        }
      `}</style>
    </div>
  );
}