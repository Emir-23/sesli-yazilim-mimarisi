import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Mic, Send, StopCircle, ArrowLeft } from 'lucide-react';

export default function MeetingRoom() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [meetingNotes, setMeetingNotes] = useState('');
  const projectId = useMemo(() => id || '1', [id]);

  const sendToBackend = async (text, type = 'text') => {
    if (!text.trim()) return;
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/projects/${projectId}/chat-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          message: text,
          type,
          user_name: 'Cemil Ay',
          sent_at: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        console.error("Backend'e kayit basarisiz oldu:", response.statusText);
      }
    } catch (error) {
      console.error('Backend baglanti hatasi:', error);
    }
  };

  const saveMeetingDraft = () => {
    const payload = {
      notes: meetingNotes.trim(),
      messages: messages.map((m) => m.text).join('\n'),
    };
    sessionStorage.setItem(`meeting:${projectId}`, JSON.stringify(payload));
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;
    const newMessage = { id: Date.now(), text: inputValue, sender: 'You', type: 'text' };
    setMessages((prev) => [...prev, newMessage]);
    setInputValue('');
    await sendToBackend(newMessage.text, 'text');
  };

  const handleToggleRecording = async () => {
    if (isRecording) {
      setIsRecording(false);
      const simulatedTranscript = 'Ornek ses kaydi dokumu: Kullanici sinifi Auth sinifina baglanmalidir.';
      const newMessage = { id: Date.now(), text: `🎙️ ${simulatedTranscript}`, sender: 'System', type: 'audio_transcript' };
      setMessages((prev) => [...prev, newMessage]);
      await sendToBackend(simulatedTranscript, 'audio_transcript');
    } else {
      setIsRecording(true);
    }
  };

  const handleGoWorkspace = () => {
    saveMeetingDraft();
    navigate(`/workspace/${projectId}`);
  };

  return (
    <div style={{ height: '100vh', backgroundColor: '#0f172a', color: 'white', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '15px 20px', backgroundColor: '#1e293b', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <ArrowLeft size={18} style={{ marginRight: '8px' }} /> Projeye Don
          </button>
          <h2 style={{ margin: 0, fontSize: '18px' }}>📥 Veri Toplama Odası (#{projectId})</h2>
        </div>
        <button onClick={handleGoWorkspace} style={{ backgroundColor: '#10b981', border: 'none', color: 'white', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
          UML Çiz ve Analiz Et
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', padding: '20px', gap: '20px' }}>
        <div style={{ width: '40%', minWidth: '320px', backgroundColor: '#1e293b', borderRadius: '8px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', padding: '15px', gap: '12px' }}>
          <h3 style={{ margin: 0, color: '#e2e8f0' }}>Veri Toplama</h3>
          <button style={{ backgroundColor: '#10b981', border: 'none', color: 'white', padding: '10px', borderRadius: '6px', cursor: 'pointer' }}>
            Dosya Yükle (.txt/.mp3)
          </button>
          <button
            onClick={handleToggleRecording}
            style={{ backgroundColor: isRecording ? '#ef4444' : '#334155', color: 'white', border: 'none', padding: '10px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            {isRecording ? <StopCircle size={18} /> : <Mic size={18} />} Canlı Sesli Oda (Mikrofon)
          </button>
          <textarea
            value={meetingNotes}
            onChange={(e) => setMeetingNotes(e.target.value)}
            placeholder="Toplantıdan topladığın metni buraya ekle..."
            style={{ flex: 1, minHeight: '220px', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#e2e8f0', borderRadius: '8px', padding: '10px', resize: 'vertical' }}
          />
        </div>

        <div style={{ flex: 1, backgroundColor: '#1e293b', borderRadius: '8px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '12px 15px', borderBottom: '1px solid #334155', fontWeight: 'bold', color: '#e2e8f0' }}>Canlı Chat</div>
          <div style={{ flex: 1, padding: '15px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {messages.length === 0 && (
              <div style={{ color: '#64748b', textAlign: 'center', marginTop: '20px' }}>Henuz mesaj yok. Toplantiya baslayin!</div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} style={{ alignSelf: msg.sender === 'You' ? 'flex-end' : 'flex-start', backgroundColor: msg.sender === 'You' ? '#10b981' : '#334155', color: 'white', padding: '10px 15px', borderRadius: '8px', maxWidth: '80%' }}>
                <div style={{ fontSize: '10px', opacity: 0.7, marginBottom: '4px' }}>{msg.sender}</div>
                <div style={{ fontSize: '14px', lineHeight: '1.4' }}>{msg.text}</div>
              </div>
            ))}
          </div>

          <div style={{ padding: '15px', borderTop: '1px solid #334155', backgroundColor: '#0f172a', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={handleToggleRecording}
              style={{ backgroundColor: isRecording ? '#ef4444' : '#334155', color: 'white', border: 'none', padding: '10px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 0.3s' }}
              title={isRecording ? 'Kaydi Durdur' : 'Ses Kaydet'}
            >
              {isRecording ? <StopCircle size={20} /> : <Mic size={20} />}
            </button>

            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={isRecording ? 'Kayit yapiliyor...' : 'Mesajinizi yazin...'}
              disabled={isRecording}
              style={{ flex: 1, backgroundColor: '#1e293b', border: '1px solid #334155', color: 'white', padding: '10px 15px', borderRadius: '20px', outline: 'none' }}
            />

            <button
              onClick={handleSendMessage}
              disabled={isRecording || !inputValue.trim()}
              style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '10px', borderRadius: '50%', cursor: !inputValue.trim() || isRecording ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: !inputValue.trim() || isRecording ? 0.5 : 1 }}
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}