import coverage from './fbroApiCoverage.generated.json';

export type FbroEventKind = 'notification' | 'decision' | 'deferredDecision' | 'highFrequency' | 'internal';
export type FbroEventExposure = 'public' | 'managed' | 'internal' | 'notApplicable';

export interface FbroEventFieldDefinition {
  name: string;
  sourceType: string;
  type: string;
  nullable: boolean;
  direction: 'in' | 'inout';
  ownership: 'value' | 'bridgeCopiesOrManages';
}

export interface FbroEventDefinition {
  eventId: string;
  eventToken: string;
  ownerClass: string;
  officialName: string;
  officialAliases: string[];
  legacyAliases: string[];
  lingBuilderName: string;
  category: string;
  kind: FbroEventKind;
  exposure: FbroEventExposure;
  thread: string;
  decisionMode: 'notification' | 'immediate' | 'deferred';
  fields: FbroEventFieldDefinition[];
  responseSchema: Record<string, unknown>;
  defaultAction: 'notify' | 'continue' | 'cancel';
  timeoutMilliseconds: number;
  maxHz: number;
  bridgeStatus: 'implemented' | 'managed' | 'internal' | 'notApplicable';
  classificationReason: string;
}

const events = coverage.eventCatalog as FbroEventDefinition[];

/** FBro 事件唯一事实源；设计器、补全、生成器和模块详情都消费此目录。 */
export const FBRO_EVENT_CATALOG: readonly FbroEventDefinition[] = events;

/** 全部公开事件：浏览器事件 + VIP WebSocket 客户端拦截 + 本地服务器回调。 */
export const FBRO_PUBLIC_BROWSER_EVENTS: readonly FbroEventDefinition[] = events.filter(
  event => event.exposure === 'public'
);

/** 设计器 FBroBrowser 控件事件：浏览器事件 + WebSocket 客户端拦截五事件；
 * 本地服务器回调不在控件上，用 FBro_绑定事件(浏览器控件, 事件名, &处理器) 绑定。 */
const FBRO_DESIGNER_INIT_EVENTS = new Set([
  'OnWebSocketClientCreate', 'OnWebSocketClientConnect', 'OnWebSocketClientClose',
  'OnWebSocketClientMessage', 'OnWebSocketClientSend'
]);

export const FBRO_BROWSER_DESIGNER_EVENTS: readonly FbroEventDefinition[] = events.filter(
  event => (event.ownerClass === 'FBroHsBroEvent' && event.exposure === 'public')
    || (event.ownerClass === 'FBroHsInitEvent' && event.exposure === 'public'
      && FBRO_DESIGNER_INIT_EVENTS.has(event.officialName))
);

const eventAliases = new Map<string, FbroEventDefinition>();
for (const event of events) {
  for (const alias of [event.eventId, event.officialName, event.lingBuilderName, ...event.officialAliases, ...event.legacyAliases]) {
    eventAliases.set(alias.trim().toLocaleLowerCase('zh-CN'), event);
  }
}

export function resolveFbroEvent(value: string): FbroEventDefinition | undefined {
  return eventAliases.get(value.trim().toLocaleLowerCase('zh-CN'));
}

export function normalizeFbroEventId(value: string): string {
  return resolveFbroEvent(value)?.eventId || value.trim();
}

export const FBRO_EVENT_BINDING_NAMES: readonly string[] = FBRO_PUBLIC_BROWSER_EVENTS.flatMap(event => [
  event.lingBuilderName,
  event.officialName,
  ...event.legacyAliases
]);

/** 由 FBro_读资源响应正文 注册的异步完成事件，不是 CEF 原生回调目录项。 */
export const FBRO_RESOURCE_RESPONSE_BODY_EVENT_NAME = '资源响应正文到达';
