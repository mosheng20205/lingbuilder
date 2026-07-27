export type EditorGroupOrientation = 'horizontal' | 'vertical';
export interface EditorGroup { id: string; tabs: string[]; activePath: string | null }
export interface EditorGroupLayout { schemaVersion: 1; orientation: EditorGroupOrientation; activeGroupId: string; groups: EditorGroup[] }

export const createEditorGroupLayout = (tabs: string[], activePath?: string): EditorGroupLayout => ({
  schemaVersion: 1, orientation: 'horizontal', activeGroupId: 'group-1',
  groups: [{ id: 'group-1', tabs: unique(tabs), activePath: activePath && tabs.includes(activePath) ? activePath : tabs[0] || null }]
});

export function splitEditorGroup(layout: EditorGroupLayout, sourcePath: string, orientation: EditorGroupOrientation): EditorGroupLayout {
  if (layout.groups.length >= 2) return { ...selectEditorGroupTab(layout, layout.groups[1].id, sourcePath), orientation };
  return normalize({ ...layout, orientation, activeGroupId: 'group-2', groups: [...layout.groups, { id: 'group-2', tabs: [sourcePath], activePath: sourcePath }] });
}

export function moveEditorTab(layout: EditorGroupLayout, sourceGroupId: string, targetGroupId: string, filePath: string): EditorGroupLayout {
  if (sourceGroupId === targetGroupId || !layout.groups.some(group => group.id === targetGroupId)) return layout;
  const groups = layout.groups.map(group => {
    if (group.id === sourceGroupId) {
      const tabs = group.tabs.filter(path => path !== filePath);
      return { ...group, tabs, activePath: group.activePath === filePath ? tabs[0] || null : group.activePath };
    }
    if (group.id === targetGroupId) return { ...group, tabs: unique([...group.tabs, filePath]), activePath: filePath };
    return group;
  });
  return normalize({ ...layout, activeGroupId: targetGroupId, groups });
}

export function selectEditorGroupTab(layout: EditorGroupLayout, groupId: string, filePath: string): EditorGroupLayout {
  return normalize({ ...layout, activeGroupId: groupId, groups: layout.groups.map(group => group.id === groupId
    ? { ...group, tabs: unique([...group.tabs, filePath]), activePath: filePath }
    : group) });
}

export function closeEditorGroupTab(layout: EditorGroupLayout, groupId: string, filePath: string): EditorGroupLayout {
  const groups = layout.groups.map(group => {
    if (group.id !== groupId) return group;
    const index = group.tabs.indexOf(filePath); const tabs = group.tabs.filter(path => path !== filePath);
    return { ...group, tabs, activePath: group.activePath === filePath ? tabs[Math.min(Math.max(0, index), tabs.length - 1)] || null : group.activePath };
  });
  return normalize({ ...layout, groups });
}

export function closeEditorGroup(layout: EditorGroupLayout, groupId: string): EditorGroupLayout {
  if (layout.groups.length === 1) return layout;
  const groups = layout.groups.filter(group => group.id !== groupId);
  return normalize({ ...layout, groups, activeGroupId: groups[0].id });
}

export function collapseEditorGroups(layout: EditorGroupLayout): EditorGroupLayout {
  if (layout.groups.length === 1) return layout;
  const primary = layout.groups[0];
  const tabs = unique(layout.groups.flatMap(group => group.tabs));
  return normalize({
    ...layout,
    orientation: 'horizontal',
    activeGroupId: primary.id,
    groups: [{
      ...primary,
      tabs,
      activePath: primary.activePath && tabs.includes(primary.activePath) ? primary.activePath : tabs[0] || null
    }]
  });
}

export function restoreEditorGroupLayout(raw: unknown, availablePaths: readonly string[], fallbackPath?: string): EditorGroupLayout {
  const available = new Set(availablePaths);
  if (!raw || typeof raw !== 'object' || (raw as any).schemaVersion !== 1 || !Array.isArray((raw as any).groups)) return createEditorGroupLayout(fallbackPath ? [fallbackPath] : [], fallbackPath);
  const groups = (raw as any).groups.slice(0, 2).map((group: any, index: number) => {
    const tabs = unique((Array.isArray(group.tabs) ? group.tabs : []).filter((item: unknown): item is string => typeof item === 'string' && available.has(item)));
    return { id: `group-${index + 1}`, tabs, activePath: tabs.includes(group.activePath) ? group.activePath : tabs[0] || null };
  }).filter((group: EditorGroup) => group.tabs.length > 0);
  if (!groups.length) return createEditorGroupLayout(fallbackPath ? [fallbackPath] : [], fallbackPath);
  return normalize({ schemaVersion: 1, orientation: (raw as any).orientation === 'vertical' ? 'vertical' : 'horizontal', activeGroupId: groups.some((group: EditorGroup) => group.id === (raw as any).activeGroupId) ? (raw as any).activeGroupId : groups[0].id, groups });
}

const normalize = (layout: EditorGroupLayout): EditorGroupLayout => {
  const groups = layout.groups.filter(group => group.tabs.length > 0 || layout.groups.length === 1).slice(0, 2);
  return { ...layout, groups, activeGroupId: groups.some(group => group.id === layout.activeGroupId) ? layout.activeGroupId : groups[0]?.id || 'group-1' };
};
const unique = (items: readonly string[]) => [...new Set(items)];
