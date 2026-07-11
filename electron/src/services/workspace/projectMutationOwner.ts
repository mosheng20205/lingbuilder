export interface ProjectMutationOwner {
  projectId: string;
  loadGeneration: number;
}

export interface ProjectMutationContext {
  activeProjectId: string;
  loadedProjectId: string;
  loadGeneration: number;
  projectFilesReady: boolean;
}

export function createProjectMutationOwner(
  projectId: string,
  loadGeneration: number
): ProjectMutationOwner {
  return { projectId, loadGeneration };
}

export function isProjectMutationOwnerCurrent(
  owner: ProjectMutationOwner,
  context: ProjectMutationContext
): boolean {
  return context.projectFilesReady
    && owner.projectId === context.activeProjectId
    && owner.projectId === context.loadedProjectId
    && owner.loadGeneration === context.loadGeneration;
}
