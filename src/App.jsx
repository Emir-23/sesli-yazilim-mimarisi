import React, { useState, useCallback } from 'react';
import ReactFlow, { Background, Controls, applyNodeChanges, applyEdgeChanges } from 'reactflow';
import 'reactflow/dist/style.css';
import { Folder, Mic, ArrowLeft, Download, RefreshCw, Upload, FileText, UserCircle, Activity, ShoppingCart, PlusSquare } from 'lucide-react';

const API_GENERATE_UML = 'http://127.0.0.1:8000/api/generate-uml';

// --- Sahte Veriler (Nodes & Edges) ---
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

export default function App() {
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);
  const [meetingText, setMeetingText] = useState('');
  const [umlResult, setUmlResult] = useState('');
  const [umlLoading, setUmlLoading] = useState(false);
  const [umlError, setUmlError] = useState('');

  const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);

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
        body: JSON.stringify({ text: meetingText }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || `İstek başarısız (HTTP ${res.status})`);
      }
      if (typeof data.uml !== 'string') {
        throw new Error('Sunucudan geçersiz yanıt alındı.');
      }
      setUmlResult(data.uml);
    } catch (e) {
      setUmlResult('');
      setUmlError(e instanceof Error ? e.message : 'Bilinmeyen hata');
    } finally {
      setUmlLoading(false);
    }
  }, [meetingText]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#0f172a', color: '#e2e8f0', fontFamily: 'sans-serif' }}>
      
      {/* --- EN ÜST BAR (Logo ve Profil) --- */}
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
          <span style={{ fontSize: '14px', color: '#e2e8f0' }}>Cemil Ay <span style={{ color: '#64748b' }}>(Mimar)</span></span>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* --- SOL MENÜ (Sidebar) --- */}
        <div style={{ width: '260px', backgroundColor: '#1e293b', padding: '15px', borderRight: '1px solid #334155', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '30px', cursor: 'pointer', color: '#94a3b8', border: '1px solid #334155', padding: '5px 10px', borderRadius: '4px', width: 'fit-content' }}>
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

        {/* --- SAĞ TARAF (Ana İçerik) --- */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#0f172a' }}>
          
          {/* Proje Başlık Barı */}
          <div style={{ padding: '12px 20px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e293b' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <h2 style={{ margin: 0, fontSize: '14px', fontWeight: '500', color: '#f8fafc' }}>Proje: Öğrenci Bilgi Sistemi (OBS)</h2>
              <select style={{ backgroundColor: '#0f172a', color: '#94a3b8', border: '1px solid #334155', padding: '4px 8px', borderRadius: '4px', outline: 'none', fontSize: '12px' }}>
                  <option>[ Sınıf Diyagramı ]</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button style={{ backgroundColor: 'transparent', color: '#94a3b8', border: '1px solid transparent', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px' }}>
                <Download size={14} /> Dışa Aktar (PNG/JSON)
              </button>
              <button
                type="button"
                onClick={handleGenerateUml}
                disabled={umlLoading}
                style={{
                  backgroundColor: 'transparent',
                  color: '#38bdf8',
                  border: '1px solid #38bdf8',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: umlLoading ? 'wait' : 'pointer',
                  fontSize: '12px',
                  opacity: umlLoading ? 0.7 : 1,
                }}
              >
                <RefreshCw size={14} /> {umlLoading ? 'Gönderiliyor…' : 'GÜNCELLE / ANALİZ ET'}
              </button>
            </div>
          </div>

          {/* 3 Kolonlu Çalışma Alanı */}
          <div style={{ flex: 1, display: 'flex', padding: '15px', gap: '15px', overflow: 'hidden' }}>
              
              {/* 1. KOLON: ZAMAN ÇİZELGESİ */}
              <div style={{ width: '220px', backgroundColor: '#1e293b', borderRadius: '6px', border: '1px solid #334155', padding: '12px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: '11px', textAlign: 'center', color: '#94a3b8', letterSpacing: '1px', marginBottom: '15px', fontWeight: 'bold' }}>ZAMAN ÇİZELGESİ</div>

                  <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Toplantı metni</label>
                  <textarea
                    value={meetingText}
                    onChange={(e) => setMeetingText(e.target.value)}
                    placeholder="Örn: Kütüphane sisteminde Kitap ve Yazar sınıfları…"
                    style={{
                      width: '100%',
                      minHeight: '88px',
                      marginBottom: '12px',
                      padding: '8px',
                      fontSize: '11px',
                      backgroundColor: '#0f172a',
                      color: '#e2e8f0',
                      border: '1px solid #334155',
                      borderRadius: '4px',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                    }}
                  />
                  
                  <button style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '8px', borderRadius: '4px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', cursor: 'pointer', marginBottom: '8px', fontSize: '12px' }}>
                      <Upload size={14}/> Dosya Yükle (.txt/.mp3)
                  </button>
                  <button style={{ backgroundColor: '#1e293b', color: '#10b981', border: '1px solid #10b981', padding: '8px', borderRadius: '4px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px' }}>
                      <Mic size={14}/> Canlı Oda Başlat
                  </button>

                  <div style={{ marginTop: '20px', fontSize: '12px', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><FileText size={14} color="#94a3b8"/> 12 Mart Gereksinim.txt</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Mic size={14} color="#a855f7"/> 15 Mart SesKaydi.mp3</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><FileText size={14} color="#94a3b8"/> 20 Mart CanlıToplantı.txt</div>
                  </div>
              </div>

              {/* 2. KOLON: REACT FLOW TUVALİ */}
              <div style={{ flex: 1, backgroundColor: '#1e293b', borderRadius: '6px', border: '1px solid #334155', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: 10, width: '100%', textAlign: 'center', zIndex: 10, color: '#94a3b8', fontSize: '11px', letterSpacing: '1px', fontWeight: 'bold' }}>REACT FLOW TUVALİ</div>
                  
                  {/* Görseldeki Gemini Açıklama Metni */}
                  <div style={{ position: 'absolute', bottom: 20, right: 20, zIndex: 10, color: '#cbd5e1', fontSize: '12px', maxWidth: '200px', textAlign: 'right', opacity: 0.8 }}>
                    Yapay Zeka (Gemini), sol paneldeki verileri okuyup şemayı buraya çizer
                  </div>

                  <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} fitView>
                      <Background color="#334155" gap={16} size={1} />
                      <Controls style={{ fill: 'white' }} showInteractive={false} />
                  </ReactFlow>
              </div>

              {/* 3. KOLON: SPRINT GÖREVLERİ */}
              <div style={{ width: '240px', backgroundColor: '#1e293b', borderRadius: '6px', border: '1px solid #334155', padding: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  {umlError ? (
                    <div style={{ fontSize: '11px', color: '#f87171', marginBottom: '10px', lineHeight: 1.4 }}>{umlError}</div>
                  ) : null}
                  {umlResult ? (
                    <div style={{ marginBottom: '12px', flexShrink: 0 }}>
                      <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 'bold', marginBottom: '6px' }}>PlantUML (API)</div>
                      <pre
                        style={{
                          margin: 0,
                          maxHeight: '160px',
                          overflow: 'auto',
                          fontSize: '10px',
                          lineHeight: 1.35,
                          color: '#cbd5e1',
                          backgroundColor: '#0f172a',
                          padding: '8px',
                          borderRadius: '4px',
                          border: '1px solid #334155',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                      >
                        {umlResult}
                      </pre>
                    </div>
                  ) : null}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>
                      <span style={{ fontSize: '11px', color: '#64748b', cursor: 'pointer' }}>TAB: [Canlı Chat]</span>
                      <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 'bold', cursor: 'pointer' }}>TAB: [■ Sprint Görevleri]</span>
                  </div>
                  
                  {/* Görev 1 */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '12px' }}>
                      <input type="checkbox" style={{ marginTop: '3px', accentColor: '#10b981' }} />
                      <div>
                          <div style={{ fontSize: '12px', color: '#e2e8f0' }}>Laravel Migration'ları Hazırlanacak</div>
                          <div style={{ fontSize: '10px', color: '#64748b' }}>Laravel Migration hangisine edilecek</div>
                      </div>
                  </div>

                  {/* Görev 2 */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '12px' }}>
                      <input type="checkbox" style={{ marginTop: '3px', accentColor: '#10b981' }} />
                      <div>
                          <div style={{ fontSize: '12px', color: '#e2e8f0' }}>Deepgram API entegre edilecek</div>
                          <div style={{ fontSize: '10px', color: '#64748b' }}>Deepgram API entegre edilecek</div>
                      </div>
                  </div>

                  {/* Görev 3 */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <input type="checkbox" style={{ marginTop: '3px', accentColor: '#10b981' }} />
                      <div>
                          <div style={{ fontSize: '12px', color: '#e2e8f0' }}>Socket.io Entegrasyonu</div>
                          <div style={{ fontSize: '10px', color: '#64748b' }}>Socket.io Post entegre edilecek</div>
                      </div>
                  </div>
              </div>

          </div>
        </div>
      </div>
    </div>
  );
}