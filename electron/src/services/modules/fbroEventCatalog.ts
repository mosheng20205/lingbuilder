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

export const FBRO_PUBLIC_BROWSER_EVENTS: readonly FbroEventDefinition[] = events.filter(
  event => event.ownerClass === 'FBroHsBroEvent' && event.exposure === 'public'
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
