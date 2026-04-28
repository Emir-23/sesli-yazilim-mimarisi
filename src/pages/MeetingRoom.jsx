import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Send, StopCircle, ArrowLeft } from 'lucide-react';

export default function MeetingRoom() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [projectId] = useState(1); // Şimdilik statik proje id'si

  // Backend'e veri gönderen ortak fonksiyon
  const sendToBackend = async (text, type = 'text') => {
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/projects/${projectId}/chat-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          message: text,
          type: type, // text veya audio_transcript
          user_name: "Cemil Ay",
          sent_at: new Date().toISOString()
        }),
      });

      if (response.ok) {
        console.log("Veri başarıyla veritabanına kaydedildi.");
      } else {
        console.error("Backend'e kayıt başarısız oldu:", response.statusText);
      }
    } catch (error) {
      console.error("Backend bağlantı hatası:", error);
    }
  };

  // Chat mesajı gönderme
  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const newMessage = { id: Date.now(), text: inputValue, sender: 'You', type: 'text' };
    setMessages((prev) => [...prev, newMessage]);
    setInputValue('');

    // Backend'e yolla
    await sendToBackend(newMessage.text, 'text');
  };

  // Ses kaydını başlatma / durdurma simülasyonu
  const handleToggleRecording = async () => {
    if (isRecording) {
      setIsRecording(false);

      // Kayıt bittiğinde örnek bir transcript üretip backend'e kaydedelim
      const simulatedTranscript = "Örnek ses kaydı dökümü: Kullanıcı sınıfı Auth sınıfına bağlanmalıdır.";
      const newMessage = { id: Date.now(), text: `🎙️ ${simulatedTranscript}`, sender: 'System', type: 'audio_transcript' };
      setMessages((prev) => [...prev, newMessage]);

      // Transcript'i backend'e yolla
      await sendToBackend(simulatedTranscript, 'audio_transcript');
    } else {
      setIsRecording(true);
    }
  };

  return (
    <div style={{ height: '100vh', backgroundColor: '#0f172a', color: 'white', display: 'flex', flexDirection: 'column' }}>
      {/* Üst Bar */}
      <div style={{ padding: '15px 20px', backgroundColor: '#1e293b', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button onClick={() => navigate('/uml')} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <ArrowLeft size={18} style={{ marginRight: '8px' }} /> Projeye Dön
          </button>
          <h2 style={{ margin: 0, fontSize: '18px' }}>🎙️ Canlı Toplantı Odası</h2>
        </div>
      </div>

      {/* İçerik Alanı */}
      <div style={{ flex: 1, display: 'flex', padding: '20px', gap: '20px', justifyContent: 'center' }}>

        {/* Chat Alanı */}
        <div style={{ width: '500px', backgroundColor: '#1e293b', borderRadius: '8px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Mesaj Listesi */}
          <div style={{ flex: 1, padding: '15px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {messages.length === 0 && (
              <div style={{ color: '#64748b', textAlign: 'center', marginTop: '20px' }}>Henüz mesaj yok. Toplantıya başlayın!</div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} style={{ alignSelf: msg.sender === 'You' ? 'flex-end' : 'flex-start', backgroundColor: msg.sender === 'You' ? '#10b981' : '#334155', color: 'white', padding: '10px 15px', borderRadius: '8px', maxWidth: '80%' }}>
                <div style={{ fontSize: '10px', opacity: 0.7, marginBottom: '4px' }}>{msg.sender}</div>
                <div style={{ fontSize: '14px', lineHeight: '1.4' }}>{msg.text}</div>
              </div>
            ))}
          </div>

          {/* Mesaj Yazma / Ses Kaydı Alanı */}
          <div style={{ padding: '15px', borderTop: '1px solid #334155', backgroundColor: '#0f172a', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={handleToggleRecording}
              style={{ backgroundColor: isRecording ? '#ef4444' : '#334155', color: 'white', border: 'none', padding: '10px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 0.3s' }}
              title={isRecording ? 'Kaydı Durdur' : 'Ses Kaydet'}
            >
              {isRecording ? <StopCircle size={20} /> : <Mic size={20} />}
            </button>

            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={isRecording ? 'Kayıt yapılıyor...' : 'Mesajınızı yazın...'}
              disabled={isRecording}
              style={{ flex: 1, backgroundColor: '#1e293b', border: '1px solid #334155', color: 'white', padding: '10px 15px', borderRadius: '20px', outline: 'none' }}
            />

            <button
              onClick={handleSendMessage}
              disabled={isRecording || !inputValue.trim()}
              style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '10px', borderRadius: '50%', cursor: (!inputValue.trim() || isRecording) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: (!inputValue.trim() || isRecording) ? 0.5 : 1 }}
            >
              <Send size={20} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}