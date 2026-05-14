import { useState } from 'react';
import { Activity, Loader2, Lock, Mail, UserPlus } from 'lucide-react';

const field = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 10,
  border: '1px solid #334155',
  backgroundColor: '#0f172a',
  color: '#f8fafc',
  fontSize: 15,
  outline: 'none',
  boxSizing: 'border-box',
};

export default function AuthScreen({ onLogin, onRegister }) {
  const [mode, setMode] = useState('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const resetForm = () => {
    setError('');
    setPassword('');
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') {
        const r = await onLogin({ email, password });
        if (!r.ok) setError(r.error || 'Giriş yapılamadı.');
      } else {
        const r = await onRegister({ displayName, email, password });
        if (!r.ok) setError(r.error || 'Kayıt tamamlanamadı.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background:
          'radial-gradient(900px 500px at 10% 0%, rgba(16, 185, 129, 0.12), transparent 55%), #0f172a',
        color: '#e2e8f0',
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          borderRadius: 16,
          border: '1px solid #334155',
          backgroundColor: '#1e293b',
          boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '22px 24px',
            borderBottom: '1px solid #334155',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Activity size={28} color="#10b981" />
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: '#f8fafc' }}>SesMimari AI</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
              Hesabınızla giriş yapın veya kayıt olun
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', padding: 6, gap: 6, borderBottom: '1px solid #334155' }}>
          <button
            type="button"
            onClick={() => {
              setMode('login');
              resetForm();
            }}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 10,
              border: mode === 'login' ? '1px solid #10b981' : '1px solid transparent',
              backgroundColor: mode === 'login' ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
              color: mode === 'login' ? '#10b981' : '#94a3b8',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Giriş
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              resetForm();
            }}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 10,
              border: mode === 'register' ? '1px solid #10b981' : '1px solid transparent',
              backgroundColor: mode === 'register' ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
              color: mode === 'register' ? '#10b981' : '#94a3b8',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Kayıt ol
          </button>
        </div>

        <form onSubmit={submit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {mode === 'register' ? (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
                <UserPlus size={14} /> Görünen ad
              </span>
              <input
                autoComplete="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Örn: Ayşe Yılmaz"
                style={field}
              />
            </label>
          ) : null}

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Mail size={14} /> E-posta
            </span>
            <input
              type="email"
              required
              autoComplete={mode === 'login' ? 'email' : 'username'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ornek@posta.com"
              style={field}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Lock size={14} /> Şifre
            </span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="En az 6 karakter"
              style={field}
            />
          </label>

          {error ? (
            <div
              role="alert"
              style={{
                fontSize: 13,
                color: '#fecaca',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                padding: '10px 12px',
                borderRadius: 10,
                lineHeight: 1.45,
              }}
            >
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            style={{
              marginTop: 4,
              padding: '14px 16px',
              borderRadius: 10,
              border: 'none',
              background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
              color: '#fff',
              fontWeight: 700,
              fontSize: 15,
              cursor: busy ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              opacity: busy ? 0.85 : 1,
            }}
          >
            {busy ? <Loader2 size={20} className="spin" /> : null}
            {mode === 'login' ? 'Giriş yap' : 'Hesap oluştur'}
          </button>

          <p style={{ margin: 0, fontSize: 12, color: '#64748b', lineHeight: 1.5, textAlign: 'center' }}>
            Veriler bu tarayıcıda saklanır. Üretim ortamında sunucu kimlik doğrulaması kullanın.
          </p>
        </form>
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.9s linear infinite; }
      `}</style>
    </div>
  );
}
