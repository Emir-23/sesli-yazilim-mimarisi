import { Activity, FolderKanban, PlusCircle, ShoppingCart, Stethoscope } from 'lucide-react';

function iconForName(name) {
  const n = name.toLowerCase();
  if (n.includes('e-ticaret') || n.includes('ticaret')) return ShoppingCart;
  if (n.includes('hastane')) return Stethoscope;
  return FolderKanban;
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export default function HubStep({ projects, onOpenProject, onNewProject }) {
  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <aside
        style={{
          width: 300,
          flexShrink: 0,
          backgroundColor: '#1e293b',
          borderRight: '1px solid #334155',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>Çalışma alanı</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: '#f8fafc', lineHeight: 1.25 }}>
            Projeleriniz
          </h1>
          <p style={{ margin: '10px 0 0', fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>
            Kaynak yükleme ve canlı oda adımlarından sonra diyagram tuvaline geçin.
          </p>
        </div>

        <button
          type="button"
          onClick={onNewProject}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: '14px 16px',
            borderRadius: 10,
            border: '1px solid #10b981',
            background: 'linear-gradient(135deg, #059669 0%, #10b981 55%, #34d399 100%)',
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.25)',
          }}
        >
          <PlusCircle size={22} strokeWidth={2} />
          Yeni proje başlat
        </button>

        <div
          style={{
            marginTop: 'auto',
            padding: 14,
            borderRadius: 10,
            backgroundColor: '#0f172a',
            border: '1px solid #334155',
            fontSize: 12,
            color: '#94a3b8',
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: '#e2e8f0' }}>3 adımlı akış</strong>
          <ol style={{ margin: '10px 0 0', paddingLeft: 18 }}>
            <li style={{ marginBottom: 6 }}>Proje seçimi</li>
            <li style={{ marginBottom: 6 }}>Dosya ve canlı oda</li>
            <li>React Flow tuvali</li>
          </ol>
        </div>
      </aside>

      <main
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '28px 32px',
          background:
            'radial-gradient(1200px 600px at 20% 0%, rgba(16, 185, 129, 0.08), transparent 50%), #0f172a',
        }}
      >
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <Activity size={20} color="#10b981" />
            <span style={{ fontSize: 13, color: '#94a3b8', letterSpacing: 0.4 }}>SON PROJELER</span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 16,
            }}
          >
            {projects.length === 0 ? (
              <div
                style={{
                  gridColumn: '1 / -1',
                  padding: 28,
                  borderRadius: 12,
                  border: '1px dashed #334155',
                  backgroundColor: '#1e293b',
                  color: '#94a3b8',
                  fontSize: 14,
                  lineHeight: 1.6,
                  textAlign: 'center',
                }}
              >
                Henüz proje yok. Soldan <strong style={{ color: '#e2e8f0' }}>Yeni proje başlat</strong> ile
                ilk çalışmanızı oluşturun; projeler yalnızca sizin hesabınıza özel saklanır.
              </div>
            ) : null}
            {projects.map((p) => {
              const Icon = iconForName(p.name);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onOpenProject(p.id)}
                  style={{
                    textAlign: 'left',
                    padding: 18,
                    borderRadius: 12,
                    border: '1px solid #334155',
                    backgroundColor: '#1e293b',
                    color: '#e2e8f0',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s, transform 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#10b981';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#334155';
                    e.currentTarget.style.transform = 'none';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        backgroundColor: '#0f172a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid #334155',
                      }}
                    >
                      <Icon size={22} color="#94a3b8" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        {p.diagramLabel || 'Diyagram'} · {formatDate(p.createdAt)}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                        {(p.files?.length ?? 0)} dosya
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
