export interface WorkspaceSaveEchoSnapshot {
  projectId: string;
  files: Readonly<Record<string, string>>;
  designerPath: string;
  designerSnapshot: string;
}

export interface WorkspaceSaveEchoCandidate {
  projectId: string;
  filePath: string;
  content: string;
  kind: 'source' | 'designer';
}

export const isWorkspaceSaveEcho = (
  snapshots: Iterable<WorkspaceSaveEchoSnapshot>,
  candidate: WorkspaceSaveEchoCandidate
): boolean => {
  for (const snapshot of snapshots) {
    if (snapshot.projectId !== candidate.projectId) continue;
    if (candidate.kind === 'designer') {
      if (snapshot.designerPath === candidate.filePath
        && snapshot.designerSnapshot === candidate.content) return true;
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(snapshot.files, candidate.filePath)
      && snapshot.files[candidate.filePath] === candidate.content) return true;
  }
  return false;
};
