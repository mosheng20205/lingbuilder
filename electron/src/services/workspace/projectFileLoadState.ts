export type ProjectFileLoadStatus = 'loading' | 'ready' | 'error';

export interface ProjectFileLoadState {
  projectId: string;
  status: ProjectFileLoadStatus;
  error?: string;
}

export type ProjectFileEditorAvailability = 'loading' | 'ready' | 'error';

export function createProjectFileLoadState(
  projectId: string,
  status: ProjectFileLoadStatus = 'loading',
  error?: string
): ProjectFileLoadState {
  return {
    projectId,
    status,
    ...(status === 'error' && error?.trim() ? { error: error.trim() } : {})
  };
}

export function getProjectFileEditorAvailability(
  activeProjectId: string,
  loadedProjectId: string,
  state: ProjectFileLoadState
): ProjectFileEditorAvailability {
  if (state.projectId === activeProjectId && state.status === 'error') return 'error';
  if (
    activeProjectId === loadedProjectId
    && state.projectId === activeProjectId
    && state.status === 'ready'
  ) return 'ready';
  return 'loading';
}

/** Failed loads may switch away or retry; only an active request blocks another switch. */
export function isProjectFileLoadPending(
  activeProjectId: string,
  loadedProjectId: string,
  state: ProjectFileLoadState
): boolean {
  return getProjectFileEditorAvailability(activeProjectId, loadedProjectId, state) === 'loading';
}

export function hasUsableProjectFilePayload(files: unknown): files is Record<string, string> {
  if (!files || typeof files !== 'object' || Array.isArray(files)) return false;
  const entries = Object.entries(files as Record<string, unknown>);
  return entries.length > 0 && entries.every(([filePath, content]) => filePath.trim() && typeof content === 'string');
}
