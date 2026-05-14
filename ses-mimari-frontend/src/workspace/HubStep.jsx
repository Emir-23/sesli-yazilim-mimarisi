import { useState } from 'react';
import {
  Activity,
  FolderKanban,
  Loader2,
  PlusCircle,
  Radio,
  ShoppingCart,
  Stethoscope,
  Trash2,
} from 'lucide-react';
import { formatDiagramTypeLabel } from './constants';

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

export default function HubStep({ projects, onOpenProject, onDeleteProject, onNewProject, onJoinQuickRoom }) {
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [joinWarning, setJoinWarning] = useState('');

  const handleQuickJoin = async () => {
    if (!onJoinQuickRoom || joinBusy) return;
    setJoinError('');
    setJoinWarning('');
    setJoinBusy(true);
    try {
      const result = await onJoinQuickRoom(roomCodeInput);
      if (result?.warning) setJoinWarning(result.warning);
      if (!result?.ok) setJoinError(result?.error || 'Katılım başarısız.');
    } finally {
      setJoinBusy(false);
    }
  };

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
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) min(360px, 34vw)',
            gap: 28,
            alignItems: 'start',
            maxWidth: 1280,
            margin: '0 auto',
          }}
        >
          <section style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <Activity size={20} color="#10b981" />
              <span style={{ fontSize: 13, color: '#94a3b8', letterSpacing: 0.4 }}>SON PROJELER</span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
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
                  <div
                    key={p.id}
                    style={{
                      position: 'relative',
                      borderRadius: 12,
                      border: '1px solid #334155',
                      backgroundColor: '#1e293b',
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
                    <button
                      type="button"
                      onClick={() => onOpenProject(p.id)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: 18,
                        paddingRight: 48,
                        border: 'none',
                        borderRadius: 12,
                        background: 'transparent',
                        color: '#e2e8f0',
                        cursor: 'pointer',
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
                            {formatDiagramTypeLabel(p.diagramType)} · {formatDate(p.createdAt)}
                          </div>
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                            {(p.files?.length ?? 0)} dosya
                          </div>
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      title="Projeyi sil"
                      aria-label={`${p.name} projesini sil`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const name = String(p.name || 'Bu proje').trim() || 'Bu proje';
                        if (
                          !onDeleteProject ||
                          !window.confirm(
                            `“${name}” projesini silmek istediğinize emin misiniz? Bu işlem geri alınamaz; proje oturum verileri bu cihazdan kaldırılır.`,
                          )
                        ) {
                          return;
                        }
                        onDeleteProject(p.id);
                      }}
                      style={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 36,
                        height: 36,
                        padding: 0,
                        borderRadius: 8,
                        border: '1px solid #475569',
                        backgroundColor: '#0f172a',
                        color: '#94a3b8',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#f87171';
                        e.currentTarget.style.color = '#fecaca';
                        e.currentTarget.style.backgroundColor = 'rgba(127, 29, 29, 0.35)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#475569';
                        e.currentTarget.style.color = '#94a3b8';
                        e.currentTarget.style.backgroundColor = '#0f172a';
                      }}
                    >
                      <Trash2 size={18} strokeWidth={2} aria-hidden />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          <aside className="ses-glass-panel relative shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/55 p-5 shadow-xl shadow-black/35 backdrop-blur-xl sm:p-6">
            <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl" aria-hidden />
            <div className="relative flex flex-col gap-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-300">
                  <Radio size={20} strokeWidth={2} aria-hidden />
                </span>
                <div>
                  <h2 className="text-base font-bold tracking-tight text-white sm:text-lg">Canlı Odaya Katıl</h2>
                  <p className="text-[11px] text-slate-400 sm:text-xs">Hızlı katılım · Misafir görünümü</p>
                </div>
              </div>
              <p className="text-xs leading-relaxed text-slate-400 sm:text-sm">
                Ev sahibinin paylaştığı oda kodunu girin; yeni proje oluşturmadan doğrudan Kaynaklar çalışma alanına
                gidersiniz. Dosya ve sohbet, soket üzerinden senkronize edilir.
              </p>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Oda kodunu giriniz
              </label>
              <input
                type="text"
                value={roomCodeInput}
                onChange={(e) => {
                  setRoomCodeInput(e.target.value);
                  if (joinError) setJoinError('');
                  if (joinWarning) setJoinWarning('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !joinBusy) void handleQuickJoin();
                }}
                placeholder="Örn: ELZ8-738"
                autoComplete="off"
                disabled={joinBusy}
                className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-3 font-mono text-sm tracking-widest text-white outline-none placeholder:text-slate-600 placeholder:tracking-normal focus:border-emerald-500/40 disabled:opacity-60"
              />
              {joinError ? <p className="text-xs text-rose-400">{joinError}</p> : null}
              {joinWarning ? <p className="text-xs text-amber-200/90">{joinWarning}</p> : null}
              <button
                type="button"
                disabled={joinBusy || !roomCodeInput.trim()}
                onClick={() => void handleQuickJoin()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-950/30 transition hover:from-cyan-500 hover:to-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {joinBusy ? <Loader2 size={18} className="ses-ai-spinner shrink-0" aria-hidden /> : null}
                {joinBusy ? 'Bağlanılıyor…' : 'Toplantıya Katıl'}
              </button>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
