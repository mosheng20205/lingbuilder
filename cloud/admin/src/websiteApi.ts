export const CLOUD_API = import.meta.env.VITE_CLOUD_API_URL || 'http://127.0.0.1:17900';

export interface WebsiteMirror { id: string; provider: string; label: string; url: string; accessCode: string; enabled: boolean; sortOrder: number }
export interface WebsiteDownload { id: string; version: string; channel: string; platform: string; architecture: string; title: string; summary: string; releaseNotes: string; minimumRequirements: string; fileSize: string; sha256: string; publicationStatus: string; publishedAt?: string; sortOrder: number; mirrors: WebsiteMirror[] }
export interface WebsiteGuide { id: string; slug: string; title: string; summary: string; kind: string; category: string; bodyMarkdown: string; tags: string[]; minimumVersion: string; publicationStatus: string; sortOrder: number; updatedAt: string }
export interface WebsiteDemo { id: string; slug: string; title: string; summary: string; category: string; difficulty: string; lingBuilderVersion: string; modules: string[]; prerequisites: string; sourceLinks: Array<{label: string; url: string}>; screenshotUrl: string; videoUrl: string; license: string; publicationStatus: string; sortOrder: number }
export interface WebsiteGroup { id: string; name: string; qqNumber: string; groupType: string; joinUrl: string; qrCodeUrl: string; description: string; statusText: string; enabled: boolean; sortOrder: number }
export interface WebsiteSponsor { id: string; qqNumber: string; amountCents: number; sponsoredAt: string; enabled: boolean; createdAt: string; updatedAt: string }
export interface WebsiteCommand { id: string; stableKey: string; name: string; aliases: string[]; summary: string; kind: string; category: string; moduleId?: string; moduleName?: string; signature: string; returnType: string; returnDescription: string; parameters: Array<{name?: string; type?: string; description?: string}>; examples: string[]; supportedBackends: string[]; minimumVersion: string; lifecycle: string; source: string; sourceVersion: string; publicationStatus: string }
export interface WebsiteBootstrap { ok: true; downloads: WebsiteDownload[]; guides: WebsiteGuide[]; demos: WebsiteDemo[]; groups: WebsiteGroup[]; sponsors: WebsiteSponsor[] }

export async function fetchWebsiteBootstrap(signal?: AbortSignal): Promise<WebsiteBootstrap> {
  const response = await fetch(`${CLOUD_API}/v1/site/bootstrap`, { signal });
  if (!response.ok) throw new Error('官网内容暂时无法加载。');
  return response.json();
}
