export interface DependencyProject { id: string; references?: string[] }

export function validateProjectDependencies(projects: readonly DependencyProject[]): void {
  const ids = new Set(projects.map(project => project.id));
  for (const project of projects) for (const reference of project.references || []) {
    if (reference === project.id) throw new Error(`项目“${project.id}”不能引用自身。`);
    if (!ids.has(reference)) throw new Error(`项目“${project.id}”引用了不存在的项目“${reference}”。`);
  }
  topologicalProjectOrder(projects);
}

export function topologicalProjectOrder(projects: readonly DependencyProject[], selectedIds?: readonly string[]): string[] {
  const byId = new Map(projects.map(project => [project.id, project]));
  const roots = selectedIds?.length ? selectedIds : projects.map(project => project.id);
  const required = new Set<string>();
  const collect = (id: string) => { if (required.has(id)) return; const project = byId.get(id); if (!project) throw new Error(`未找到项目“${id}”。`); required.add(id); (project.references || []).forEach(collect); };
  roots.forEach(collect);
  const state = new Map<string, 0 | 1 | 2>(); const result: string[] = []; const stack: string[] = [];
  const visit = (id: string) => {
    if (state.get(id) === 2) return;
    if (state.get(id) === 1) { const start = stack.indexOf(id); throw new Error(`项目引用存在循环：${[...stack.slice(start), id].join(' -> ')}`); }
    state.set(id, 1); stack.push(id);
    for (const dependency of byId.get(id)?.references || []) if (required.has(dependency)) visit(dependency);
    stack.pop(); state.set(id, 2); result.push(id);
  };
  roots.forEach(visit);
  return result;
}

export function normalizeStartupProjects(projects: readonly DependencyProject[], startupProjectIds: unknown, fallbackId: string): string[] {
  const ids = new Set(projects.map(project => project.id));
  const normalized = Array.isArray(startupProjectIds)
    ? [...new Set(startupProjectIds.filter((id): id is string => typeof id === 'string' && ids.has(id)))]
    : [];
  return normalized.length ? normalized : ids.has(fallbackId) ? [fallbackId] : projects[0] ? [projects[0].id] : [];
}
