export type DesignerNavigationTargetKind = 'visual' | 'nonVisual' | 'resource';

export interface DesignerNavigationRequest {
  requestId: string;
  projectId: string;
  windowId: string;
  controlId: string;
  kind: DesignerNavigationTargetKind;
  name?: string;
}

type DesignerNavigationListener = (request: DesignerNavigationRequest) => void;
type DesignerNavigationTargetHandler = (request: DesignerNavigationRequest) => boolean | void;

export interface DesignerNavigationTarget {
  projectId: string;
  windowId: string;
  controlId: string;
  kind: DesignerNavigationTargetKind;
}

const pendingByProject = new Map<string, DesignerNavigationRequest>();
const listeners = new Set<DesignerNavigationListener>();
const targetHandlers = new Map<string, Set<DesignerNavigationTargetHandler>>();
let requestSerial = 0;

export function requestDesignerNavigation(
  request: Omit<DesignerNavigationRequest, 'requestId'> & { requestId?: string }
): DesignerNavigationRequest {
  const normalized: DesignerNavigationRequest = {
    ...request,
    requestId: request.requestId || `designer-navigation-${Date.now()}-${++requestSerial}`
  };
  pendingByProject.set(normalized.projectId, normalized);
  [...listeners].forEach(listener => listener(normalized));
  deliverDesignerNavigation(normalized);
  return normalized;
}

export function getPendingDesignerNavigation(projectId: string): DesignerNavigationRequest | undefined {
  return pendingByProject.get(projectId);
}

export function completeDesignerNavigation(requestId: string): void {
  for (const [projectId, request] of pendingByProject) {
    if (request.requestId === requestId) pendingByProject.delete(projectId);
  }
}

export function subscribeDesignerNavigation(listener: DesignerNavigationListener): { dispose(): void } {
  listeners.add(listener);
  return { dispose: () => listeners.delete(listener) };
}

export function registerDesignerNavigationTarget(
  target: DesignerNavigationTarget,
  handler: DesignerNavigationTargetHandler
): { dispose(): void } {
  const key = targetKey(target);
  const handlers = targetHandlers.get(key) || new Set<DesignerNavigationTargetHandler>();
  handlers.add(handler);
  targetHandlers.set(key, handlers);
  const pending = pendingByProject.get(target.projectId);
  if (pending && targetKey(pending) === key) deliverDesignerNavigation(pending);
  return {
    dispose: () => {
      handlers.delete(handler);
      if (handlers.size === 0) targetHandlers.delete(key);
    }
  };
}

export function clearDesignerNavigationRequests(): void {
  pendingByProject.clear();
}

function deliverDesignerNavigation(request: DesignerNavigationRequest): void {
  const handlers = targetHandlers.get(targetKey(request));
  if (!handlers?.size) return;
  for (const handler of [...handlers]) {
    if (handler(request) === false) continue;
    completeDesignerNavigation(request.requestId);
    return;
  }
}

function targetKey(target: DesignerNavigationTarget): string {
  return [target.projectId, target.windowId, target.kind, target.controlId].join('\u0000');
}
