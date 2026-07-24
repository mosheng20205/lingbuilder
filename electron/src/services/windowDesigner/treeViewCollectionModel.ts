import type { Win32ControlPropertyValue } from './win32ControlRegistry';

export interface TreeViewEditableNode extends Record<string, unknown> {
  id: string;
  title: string;
  image: number;
  expanded: boolean;
  children: TreeViewEditableNode[];
}

export interface TreeViewFlatNode {
  node: TreeViewEditableNode;
  parentId?: string;
  depth: number;
  siblingIndex: number;
  siblingCount: number;
}

function nextNodeId(usedIds: Set<string>, preferred = 'node'): string {
  const base = preferred.trim().replace(/[^\p{L}\p{N}_-]+/gu, '-') || 'node';
  if (!usedIds.has(base)) {
    usedIds.add(base);
    return base;
  }
  let suffix = 2;
  while (usedIds.has(`${base}-${suffix}`)) suffix += 1;
  const id = `${base}-${suffix}`;
  usedIds.add(id);
  return id;
}

export function normalizeTreeViewNodes(value: Win32ControlPropertyValue | undefined): TreeViewEditableNode[] {
  const usedIds = new Set<string>();
  const normalize = (items: unknown): TreeViewEditableNode[] => Array.isArray(items)
    ? items.flatMap((item, index) => {
        if (!item || typeof item !== 'object') return [];
        const record = item as Record<string, unknown>;
        const fallbackId = `node-${usedIds.size + index + 1}`;
        return [{
          id: nextNodeId(usedIds, String(record.id ?? fallbackId)),
          title: String(record.title ?? record.text ?? record.label ?? record.name ?? '新节点'),
          image: Number.isFinite(Number(record.image)) ? Math.trunc(Number(record.image)) : -1,
          expanded: record.expanded === true,
          children: normalize(record.children)
        }];
      })
    : [];
  return normalize(value);
}

export function flattenTreeViewNodes(nodes: TreeViewEditableNode[]): TreeViewFlatNode[] {
  const result: TreeViewFlatNode[] = [];
  const visit = (items: TreeViewEditableNode[], parentId: string | undefined, depth: number) => {
    items.forEach((node, siblingIndex) => {
      result.push({ node, parentId, depth, siblingIndex, siblingCount: items.length });
      visit(node.children, node.id, depth + 1);
    });
  };
  visit(nodes, undefined, 0);
  return result;
}

function mapNode(nodes: TreeViewEditableNode[], nodeId: string, mapper: (node: TreeViewEditableNode) => TreeViewEditableNode): TreeViewEditableNode[] {
  return nodes.map(node => node.id === nodeId
    ? mapper(node)
    : { ...node, children: mapNode(node.children, nodeId, mapper) });
}

function removeNode(nodes: TreeViewEditableNode[], nodeId: string): { nodes: TreeViewEditableNode[]; removed?: TreeViewEditableNode } {
  const index = nodes.findIndex(node => node.id === nodeId);
  if (index >= 0) return { nodes: [...nodes.slice(0, index), ...nodes.slice(index + 1)], removed: nodes[index] };
  let removed: TreeViewEditableNode | undefined;
  const next = nodes.map(node => {
    if (removed) return node;
    const result = removeNode(node.children, nodeId);
    removed = result.removed;
    return removed ? { ...node, children: result.nodes } : node;
  });
  return { nodes: next, removed };
}

export function updateTreeViewNode(nodes: TreeViewEditableNode[], nodeId: string, fields: Partial<Omit<TreeViewEditableNode, 'children'>>): TreeViewEditableNode[] {
  return mapNode(nodes, nodeId, node => ({ ...node, ...fields }));
}

export function appendTreeViewNode(nodes: TreeViewEditableNode[], parentId?: string): { nodes: TreeViewEditableNode[]; nodeId: string } {
  const usedIds = new Set(flattenTreeViewNodes(nodes).map(item => item.node.id));
  const nodeId = nextNodeId(usedIds, parentId ? 'child-node' : 'root-node');
  const node: TreeViewEditableNode = { id: nodeId, title: parentId ? '新子节点' : '新根节点', image: -1, expanded: false, children: [] };
  return {
    nodeId,
    nodes: parentId ? mapNode(nodes, parentId, parent => ({ ...parent, children: [...parent.children, node] })) : [...nodes, node]
  };
}

export function duplicateTreeViewNode(nodes: TreeViewEditableNode[], nodeId: string): { nodes: TreeViewEditableNode[]; nodeId?: string } {
  const flat = flattenTreeViewNodes(nodes);
  const source = flat.find(item => item.node.id === nodeId);
  if (!source) return { nodes };
  const usedIds = new Set(flat.map(item => item.node.id));
  const clone = (node: TreeViewEditableNode, root: boolean): TreeViewEditableNode => ({
    ...node,
    id: nextNodeId(usedIds, root ? `${node.id}-copy` : node.id),
    title: root ? `${node.title} 副本` : node.title,
    children: node.children.map(child => clone(child, false))
  });
  const duplicate = clone(source.node, true);
  const insert = (items: TreeViewEditableNode[]): TreeViewEditableNode[] => {
    const index = items.findIndex(node => node.id === nodeId);
    if (index >= 0) return [...items.slice(0, index + 1), duplicate, ...items.slice(index + 1)];
    return items.map(node => ({ ...node, children: insert(node.children) }));
  };
  return { nodes: insert(nodes), nodeId: duplicate.id };
}

export function deleteTreeViewNode(nodes: TreeViewEditableNode[], nodeId: string): TreeViewEditableNode[] {
  return removeNode(nodes, nodeId).nodes;
}

export function moveTreeViewNode(nodes: TreeViewEditableNode[], nodeId: string, direction: -1 | 1): TreeViewEditableNode[] {
  const move = (items: TreeViewEditableNode[]): TreeViewEditableNode[] => {
    const index = items.findIndex(node => node.id === nodeId);
    if (index >= 0) {
      const target = index + direction;
      if (target < 0 || target >= items.length) return items;
      const next = [...items];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    }
    return items.map(node => ({ ...node, children: move(node.children) }));
  };
  return move(nodes);
}

export function reparentTreeViewNode(nodes: TreeViewEditableNode[], nodeId: string, parentId?: string): TreeViewEditableNode[] {
  if (nodeId === parentId) return nodes;
  const source = flattenTreeViewNodes(nodes).find(item => item.node.id === nodeId);
  if (!source) return nodes;
  const descendantIds = new Set(flattenTreeViewNodes(source.node.children).map(item => item.node.id));
  if (parentId && descendantIds.has(parentId)) return nodes;
  const removed = removeNode(nodes, nodeId);
  if (!removed.removed) return nodes;
  if (!parentId) return [...removed.nodes, removed.removed];
  if (!flattenTreeViewNodes(removed.nodes).some(item => item.node.id === parentId)) return nodes;
  return mapNode(removed.nodes, parentId, parent => ({ ...parent, children: [...parent.children, removed.removed!] }));
}

export function isTreeViewNodeIdAvailable(nodes: TreeViewEditableNode[], nodeId: string, currentId: string): boolean {
  const normalized = nodeId.trim();
  return normalized.length > 0 && !flattenTreeViewNodes(nodes).some(item => item.node.id === normalized && item.node.id !== currentId);
}
