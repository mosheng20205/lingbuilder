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
  /** 高峰时段费率（北京时间高峰窗口内生效）；未配置时省略。 */
  peakInputPointsPerMillion?: string;
  peakCachedInputPointsPerMillion?: string;
  peakOutputPointsPerMillion?: string;
  enabled: boolean;
}

export interface AiMessage { role: 'system' | 'user' | 'assistant'; content: string }
export interface AiContextFile { filePath: string; content: string; sha256: string; language?: string }
export interface AiChatRequest {
  modelAlias: string;
  messages: AiMessage[];
  maxOutputTokens?: number;
  /** 结构化输出场景（如模块生成）请求上游关闭思考过程，避免推理文本挤占输出预算或混入正文。 */
  thinking?: 'disabled';
  rulebookVersion: string;
}
/** 系统 AI 编辑链的「允许新建文件」白名单；缺省时只能修改已有文件。
 *  安全边界：白名单只决定哪些新路径可进入提案，写盘安全仍由 IDE 侧
 *  WorkspacePathPolicy + 可写扩展名白名单在应用阶段强制。 */
export interface AiNewFileAllowance {
  /** 显式允许新建的相对路径（不带盘符、不允许 .. 上跳）。 */
  paths?: string[];
  /** 允许在其中新建文件的目录（相对工作区）。 */
  directories?: string[];
  /** 目录许可下允许的文件扩展名（含点、小写）。 */
  extensions?: string[];
  /** 新建文件数量上限（1–10，缺省 5）。 */
  maxCount?: number;
}
export interface AiEditRequest extends AiChatRequest {
  activeFilePath: string;
  instruction: string;
  files: AiContextFile[];
  /** 当前完整窗口设计器模型；仅窗口项目编辑请求使用。 */
  designerProject?: Record<string, unknown>;
  /** 允许 AI 新建文件的白名单；由客户端声明，云端据此放行新路径并写入提示词。 */
  newFiles?: AiNewFileAllowance;
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
  | { type: 'reasoning'; requestId: string; text: string }
  | { type: 'edit_draft'; requestId: string; files: Array<{ filePath: string; updatedSource: string }>; designerProject?: Record<string, unknown>; instruction?: string }
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

export type WebsitePublicationStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export interface WebsiteDownloadMirror { id: string; provider: string; label: string; url: string; accessCode: string; enabled: boolean; sortOrder: number }
export interface WebsiteDownloadRelease { id: string; version: string; channel: string; platform: string; architecture: string; title: string; summary: string; releaseNotes: string; minimumRequirements: string; fileSize: string; sha256: string; publicationStatus: WebsitePublicationStatus; publishedAt?: string; sortOrder: number; mirrors: WebsiteDownloadMirror[] }
export interface WebsiteCommandParameter { name?: string; type?: string; description?: string }
export interface WebsiteCommandReference { id: string; stableKey: string; name: string; aliases: string[]; summary: string; kind: string; category: string; moduleId?: string; moduleName?: string; signature: string; returnType: string; returnDescription: string; parameters: WebsiteCommandParameter[]; examples: string[]; supportedBackends: string[]; minimumVersion: string; lifecycle: 'AVAILABLE' | 'DEPRECATED' | string; source: string; sourceVersion: string; publicationStatus: WebsitePublicationStatus }
export interface WebsiteGuideArticle { id: string; slug: string; title: string; summary: string; kind: 'CONTROL' | 'MODULE' | 'AI' | string; category: string; bodyMarkdown: string; tags: string[]; minimumVersion: string; publicationStatus: WebsitePublicationStatus; sortOrder: number }
export interface WebsiteDemoProject { id: string; slug: string; title: string; summary: string; category: string; difficulty: string; lingBuilderVersion: string; modules: string[]; prerequisites: string; sourceLinks: Array<{ label: string; url: string }>; screenshotUrl: string; videoUrl: string; license: string; publicationStatus: WebsitePublicationStatus; sortOrder: number }
export interface WebsiteCommunityGroup { id: string; name: string; qqNumber: string; groupType: string; joinUrl: string; qrCodeUrl: string; description: string; statusText: string; enabled: boolean; sortOrder: number }
/** GET /v1/site/latest-version 响应：缺数据的字段显式为 null（null 表示不支持应用内下载，客户端回退官网）。 */
export interface SiteLatestVersionResponse {
  ok: boolean;
  available: boolean;
  version?: string;
  title?: string;
  summary?: string;
  publishedAt?: string | null;
  channel?: string | null;
  fileSize?: string | null;
  sha256?: string | null;
  releaseNotes?: string | null;
  downloadUrl?: string | null;
  message?: string;
}

export interface SdkCatalogResource {
  id: string;
  moduleId: string;
  name: string;
  platform: string;
  requiredModuleIds: string[];
  criticalFiles: string[];
  version: string;
  sdkVersion: string;
  archiveName: string;
  downloadUrl: string;
  archiveBytes: number;
  sha256: string;
  fileCount: number;
  expandedBytes: number;
}
export interface SdkCatalogPayload { schemaVersion: 1; sequence: number; resources: SdkCatalogResource[] }
export interface SdkCatalogManifestEnvelope { payload: string; keyId: string; signature: string; publishedAt: string }
export interface SdkCatalogHistoryEntry { id: string; sequence: number; keyId: string; note?: string | null; createdBy: string; createdAt: string; payloadBytes: number }

export type CloudErrorCode =
  | 'VALIDATION_FAILED' | 'NOT_FOUND' | 'AUTH_REQUIRED' | 'AUTH_INVALID' | 'EMAIL_NOT_VERIFIED'
  | 'FORBIDDEN' | 'MFA_REQUIRED' | 'RATE_LIMITED' | 'INSUFFICIENT_CREDITS'
  | 'IDEMPOTENCY_CONFLICT' | 'MODEL_UNAVAILABLE' | 'PROVIDER_FAILED' | 'EDIT_DRAFT_TRUNCATED' | 'EDIT_DRAFT_INVALID'
  | 'REQUEST_CANCELLED' | 'FILE_CONFLICT' | 'INTERNAL_ERROR'
  | 'MODULE_LOGIN_REQUIRED' | 'MODULE_PAYMENT_REQUIRED' | 'MODULE_ENTITLEMENT_EXPIRED'
  | 'MODULE_FREE_WINDOW_ENDED' | 'MODULE_ACCESS_UNAVAILABLE' | 'MODULE_PERMIT_INVALID';

export interface CloudApiError { ok: false; code: CloudErrorCode; message: string; requestId: string; details?: unknown }
