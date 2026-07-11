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
  | 'REQUEST_CANCELLED' | 'FILE_CONFLICT' | 'INTERNAL_ERROR';

export interface CloudApiError { ok: false; code: CloudErrorCode; message: string; requestId: string; details?: unknown }
