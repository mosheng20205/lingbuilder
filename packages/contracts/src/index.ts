export type AdminRole = 'super_admin' | 'operator' | 'support' | 'auditor';
export type AiProviderKind = 'openai-compatible' | 'anthropic' | 'gemini';
export type AiOperation = 'chat' | 'edit';

export interface LogicalAiModel {
  alias: string;
  displayName: string;
  description: string;
  contextWindow: number;
  maxOutputTokens: number;
  inputPointsPerMillion: string;
  cachedInputPointsPerMillion: string;
  outputPointsPerMillion: string;
  enabled: boolean;
}

export interface AiMessage { role: 'system' | 'user' | 'assistant'; content: string }
export interface AiContextFile { filePath: string; content: string; sha256: string; language?: string }
export interface AiChatRequest {
  modelAlias: string;
  messages: AiMessage[];
  maxOutputTokens?: number;
  rulebookVersion: string;
}
export interface AiEditRequest extends AiChatRequest {
  activeFilePath: string;
  instruction: string;
  files: AiContextFile[];
}

export interface UsageReceipt {
  requestId: string;
  modelAlias: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  listPricePoints: string;
  chargedPoints: string;
  estimated: boolean;
  freePromotionId?: string;
}
export interface CreditBalance { available: string; reserved: string; lifetimeGranted: string; lifetimeSpent: string }

export type ModuleOfferKind = 'perpetual' | 'fixed_term';
export type ModulePaymentProvider = 'wechat' | 'alipay' | 'manual';
export type ModuleAccessSource = 'purchase' | 'admin_grant' | 'compensation' | 'free_window';

export interface ModuleOffer {
  id: string;
  productId: string;
  name: string;
  kind: ModuleOfferKind;
  priceMinor: string;
  currency: 'CNY';
  durationDays?: number;
}

export interface ModuleCommerceState {
  moduleId: string;
  productId: string;
  name: string;
  description: string;
  listed: boolean;
  enabled: boolean;
  offers: ModuleOffer[];
  freeWindow?: { id: string; name: string; startsAt: string; endsAt: string; timezone: string };
  access?: { allowed: boolean; source?: ModuleAccessSource; expiresAt?: string; reason?: string };
}

export interface ModuleEntitlement {
  id: string;
  moduleId: string;
  source: Exclude<ModuleAccessSource, 'free_window'>;
  startsAt: string;
  endsAt?: string;
  revokedAt?: string;
}

export interface ModuleAccessPermitPayload {
  version: 1;
  keyId: string;
  userId: string;
  moduleId: string;
  source: ModuleAccessSource;
  policyVersion: number;
  issuedAt: string;
  expiresAt: string;
  serverTime: string;
}

export interface ModuleAccessPermit {
  payload: ModuleAccessPermitPayload;
  signature: string;
}

export interface ModuleOrder {
  id: string;
  moduleId: string;
  offerId: string;
  provider: ModulePaymentProvider;
  status: 'pending' | 'paid' | 'expired' | 'cancelled' | 'refunded';
  amountMinor: string;
  currency: 'CNY';
  paymentUrl?: string;
  expiresAt: string;
}

export type AiStreamEvent =
  | { type: 'accepted'; requestId: string; reservedPoints: string; freePromotionId?: string }
  | { type: 'delta'; requestId: string; text: string }
  | { type: 'edit_draft'; requestId: string; files: Array<{ filePath: string; updatedSource: string }> }
  | { type: 'usage'; requestId: string; receipt: UsageReceipt }
  | { type: 'completed'; requestId: string }
  | { type: 'error'; requestId: string; code: CloudErrorCode; message: string; retryable: boolean };

export interface ProviderChannel {
  id: string;
  name: string;
  kind: AiProviderKind;
  baseUrl: string;
  enabled: boolean;
  timeoutMs: number;
  maxConcurrency: number;
  secretConfigured: boolean;
}
export interface SystemAiProviderConfigInput {
  name: string;
  preset: 'deepseek-v4' | 'custom';
  protocol: Exclude<AiProviderKind, 'gemini'>;
  baseUrl: string;
  apiKey?: string;
  modelName?: string;
  displayName?: string;
  enabled?: boolean;
  timeoutMs?: number;
  maxConcurrency?: number;
}
export interface ModelRoute {
  id: string;
  alias: string;
  providerId: string;
  upstreamModel: string;
  version: number;
  priority: number;
  weight: number;
  enabled: boolean;
}
export interface PromotionPolicy {
  id: string;
  name: string;
  kind: 'signup_gift' | 'free_window';
  startsAt: string;
  endsAt: string;
  timezone: string;
  giftPoints?: string;
  perUserListPriceCap?: string;
  perUserRequestCap?: number;
  modelAliases: string[];
  enabled: boolean;
}

export type CloudErrorCode =
  | 'VALIDATION_FAILED' | 'AUTH_REQUIRED' | 'AUTH_INVALID' | 'EMAIL_NOT_VERIFIED'
  | 'FORBIDDEN' | 'MFA_REQUIRED' | 'RATE_LIMITED' | 'INSUFFICIENT_CREDITS'
  | 'IDEMPOTENCY_CONFLICT' | 'MODEL_UNAVAILABLE' | 'PROVIDER_FAILED'
  | 'REQUEST_CANCELLED' | 'FILE_CONFLICT' | 'INTERNAL_ERROR'
  | 'MODULE_LOGIN_REQUIRED' | 'MODULE_PAYMENT_REQUIRED' | 'MODULE_ENTITLEMENT_EXPIRED'
  | 'MODULE_FREE_WINDOW_ENDED' | 'MODULE_ACCESS_UNAVAILABLE' | 'MODULE_PERMIT_INVALID';

export interface CloudApiError { ok: false; code: CloudErrorCode; message: string; requestId: string; details?: unknown }
