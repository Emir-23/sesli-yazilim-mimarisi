import { useEffect } from 'react';
import { Activity, Home, LogOut, UserCircle } from 'lucide-react';
import AuthScreen from './auth/AuthScreen';
import { useAuth } from './auth/useAuth';
import DiagramStep from './workspace/DiagramStep';
import HubStep from './workspace/HubStep';
import SourcesStep from './workspace/SourcesStep';
import { useWorkspaceStore } from './workspace/useWorkspaceStore';

const STEP_META = [
  { step: 1, label: 'Projeler' },
  { step: 2, label: 'Dosya ve canlı oda' },
  { step: 3, label: 'React Flow tuvali' },
];

function WorkspaceShell({ user, onLogout }) {
  const {
    projects,
    activeProject,
    step,
    startNewProject,
    openProject,
    deleteProject,
    goHub,
    goSources,
    goDiagram,
    prepareDiagramHandoff,
    patchActive,
    joinQuickRoom,
    guestSocket,
    guestSocketRef,
  } = useWorkspaceStore(user.id);

  useEffect(() => {
    if ((step === 2 || step === 3) && !activeProject) {
      goHub();
    }
  }, [step, activeProject, goHub]);

  useEffect(() => {
    if (step === 3 && activeProject?.isGuest) {
      goSources();
    }
  }, [step, activeProject, goSources]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: '#0f172a',
        color: '#e2e8f0',
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
      }}
    >
      <header
        style={{
          height: 58,
          flexShrink: 0,
          backgroundColor: '#1e293b',
          borderBottom: '1px solid #334155',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <Activity size={24} color="#10b981" />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#f8fafc' }}>SesMimari AI</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>Üç aşamalı çalışma akışı</div>
            </div>
          </div>
          {step > 1 ? (
            <>
              <span
                aria-hidden
                style={{ width: 1, height: 28, backgroundColor: '#334155', flexShrink: 0 }}
              />
              <button
                type="button"
                onClick={goHub}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid #334155',
                  background: '#0f172a',
                  color: '#e2e8f0',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                <Home size={17} strokeWidth={2} />
                Ana ekrana dön
              </button>
            </>
          ) : null}
        </div>

        <nav
          aria-label="İlerleme"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {STEP_META.map(({ step: s, label }, idx) => {
            const active = step === s;
            const done = step > s;
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {idx > 0 ? (
                  <span style={{ color: '#334155', fontSize: 12, padding: '0 4px' }} aria-hidden>
                    →
                  </span>
                ) : null}
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: 0.2,
                    padding: '6px 12px',
                    borderRadius: 999,
                    border: `1px solid ${active ? '#10b981' : '#334155'}`,
                    color: active ? '#10b981' : done ? '#64748b' : '#94a3b8',
                    backgroundColor: active ? 'rgba(16, 185, 129, 0.12)' : '#0f172a',
                  }}
                >
                  {s}. {label}
                </span>
              </div>
            );
          })}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <UserCircle size={26} color="#e2e8f0" />
            <div style={{ minWidth: 0, textAlign: 'right' }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#f8fafc',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: 160,
                }}
                title={user.displayName}
              >
                {user.displayName}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: '#64748b',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 180,
                }}
                title={user.email}
              >
                {user.email}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            title="Çıkış yap"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #334155',
              background: '#0f172a',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <LogOut size={16} />
            Çıkış
          </button>
        </div>
      </header>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {step === 1 ? (
          <HubStep
            projects={projects}
            onOpenProject={openProject}
            onDeleteProject={deleteProject}
            onNewProject={startNewProject}
            onJoinQuickRoom={joinQuickRoom}
          />
        ) : null}

        {step === 2 && activeProject ? (
          <SourcesStep
            project={activeProject}
            viewerDisplayName={
              String(user.displayName || '').trim() ||
              String(user.email || '')
                .split('@')[0]
                .trim() ||
              'Kullanıcı'
            }
            onBack={goHub}
            onContinue={goDiagram}
            onPersistBeforeDiagram={prepareDiagramHandoff}
            onPatch={patchActive}
            guestSocket={activeProject?.isGuest ? guestSocket : null}
            guestSocketRef={activeProject?.isGuest ? guestSocketRef : null}
          />
        ) : null}

        {step === 3 && activeProject && !activeProject.isGuest ? (
          <DiagramStep project={activeProject} onBack={goSources} onPatch={patchActive} />
        ) : null}
      </div>
    </div>
  );
}

export default function App() {
  const auth = useAuth();

  if (!auth.user) {
    return <AuthScreen onLogin={auth.login} onRegister={auth.register} />;
  }

  return <WorkspaceShell key={auth.user.id} user={auth.user} onLogout={auth.logout} />;
}
