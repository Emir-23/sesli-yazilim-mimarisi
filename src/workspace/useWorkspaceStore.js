import { useCallback, useEffect, useMemo, useState } from 'react';
import { defaultDiagram, loadProjects, saveProjects } from './constants';

function newProject(name = 'Adsız Proje') {
  const d = defaultDiagram();
  return {
    id: crypto.randomUUID(),
    name,
    diagramLabel: 'Sınıf Diyagramı',
    createdAt: new Date().toISOString(),
    files: [],
    meetingText: '',
    umlResult: '',
    nodes: d.nodes,
    edges: d.edges,
  };
}

/**
 * @param {string} userId Oturum kullanıcı kimliği (WorkspaceShell yalnızca girişliyken mount).
 */
export function useWorkspaceStore(userId) {
  const [projects, setProjects] = useState(() => loadProjects(userId));
  const [activeId, setActiveId] = useState(null);
  const [step, setStep] = useState(1);

  useEffect(() => {
    saveProjects(userId, projects);
  }, [userId, projects]);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeId) ?? null,
    [projects, activeId],
  );

  const patchActive = useCallback(
    (partial) => {
      if (!activeId) return;
      setProjects((prev) =>
        prev.map((p) => (p.id === activeId ? { ...p, ...partial } : p)),
      );
    },
    [activeId],
  );

  const startNewProject = useCallback(() => {
    const p = newProject(`Yeni proje ${new Date().toLocaleDateString('tr-TR')}`);
    setProjects((prev) => [p, ...prev]);
    setActiveId(p.id);
    setStep(2);
  }, []);

  const openProject = useCallback((id) => {
    setActiveId(id);
    setStep(2);
  }, []);

  const goHub = useCallback(() => {
    setStep(1);
    setActiveId(null);
  }, []);

  const goSources = useCallback(() => {
    if (!activeId) return;
    setStep(2);
  }, [activeId]);

  const goDiagram = useCallback(() => {
    if (!activeId) return;
    setStep(3);
  }, [activeId]);

  return {
    projects,
    activeProject,
    activeId,
    step,
    setStep,
    startNewProject,
    openProject,
    goHub,
    goSources,
    goDiagram,
    patchActive,
  };
}
