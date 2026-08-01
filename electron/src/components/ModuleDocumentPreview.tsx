import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  FileText,
  ImageOff,
  LoaderCircle,
  RefreshCw
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ModuleDocumentContent } from '../services/modules/moduleDocumentationService';

interface ModuleDocumentPreviewProps {
  moduleId: string;
  title: string;
  documentPath: string;
  declaredDocuments: Array<{ title: string; path: string }>;
  isDarkMode: boolean;
  onOpenDocument: (path: string) => void;
}

interface ModuleDocumentApiResponse {
  ok?: boolean;
  document?: ModuleDocumentContent;
  error?: string;
}

export default function ModuleDocumentPreview({
  moduleId,
  title,
  documentPath,
  declaredDocuments,
  isDarkMode,
  onOpenDocument
}: ModuleDocumentPreviewProps) {
  const [document, setDocument] = useState<ModuleDocumentContent | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const [copied, setCopied] = useState(false);
  const borderClass = isDarkMode ? 'border-white/10' : 'border-slate-200';
  const mutedClass = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError('');
    setDocument(null);
    void fetch(`/api/modules/document?moduleId=${encodeURIComponent(moduleId)}&path=${encodeURIComponent(documentPath)}`, {
      signal: controller.signal
    }).then(async response => {
      const payload = await response.json().catch(() => ({})) as ModuleDocumentApiResponse;
      if (!response.ok || !payload.ok || !payload.document) {
        throw new Error(payload.error || '模块文档读取失败。');
      }
      setDocument(payload.document);
    }).catch(fetchError => {
      if (fetchError instanceof DOMException && fetchError.name === 'AbortError') return;
      setError(fetchError instanceof Error ? fetchError.message : '模块文档读取失败。');
    }).finally(() => {
      if (!controller.signal.aborted) setIsLoading(false);
    });
    return () => controller.abort();
  }, [documentPath, moduleId, reloadToken]);

  const declaredPathByLink = useMemo(() => new Map(
    declaredDocuments.map(item => [normalizeDocumentPath(item.path), item.path])
  ), [declaredDocuments]);

  const copySource = async () => {
    if (!document) return;
    await navigator.clipboard.writeText(document.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <section className={`min-h-full overflow-hidden rounded border ${borderClass}`} aria-busy={isLoading}>
      <header className={`flex min-w-0 items-center gap-3 border-b px-4 py-3 ${borderClass} ${isDarkMode ? 'bg-white/[0.03]' : 'bg-slate-50'}`}>
        <FileText className="h-5 w-5 shrink-0 text-sky-400" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold">{title}</h3>
          <div className={`truncate text-[11px] ${mutedClass}`} title={documentPath}>{documentPath}</div>
        </div>
        <button
          type="button"
          onClick={() => setReloadToken(value => value + 1)}
          className={`rounded p-1.5 transition-colors ${isDarkMode ? 'text-slate-300 hover:bg-white/10' : 'text-slate-600 hover:bg-slate-200'}`}
          title="重新加载文档"
          aria-label="重新加载文档"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
        <button
          type="button"
          onClick={() => void copySource()}
          disabled={!document}
          className={`rounded p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${isDarkMode ? 'text-slate-300 hover:bg-white/10' : 'text-slate-600 hover:bg-slate-200'}`}
          title={copied ? '已复制文档原文' : '复制文档原文'}
          aria-label={copied ? '已复制文档原文' : '复制文档原文'}
        >
          {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
        </button>
      </header>

      {isLoading && (
        <div className={`flex min-h-56 items-center justify-center gap-2 text-sm ${mutedClass}`} role="status">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          正在读取模块文档...
        </div>
      )}

      {!isLoading && error && (
        <div className="flex min-h-56 flex-col items-center justify-center gap-3 px-6 text-center" role="alert">
          <AlertCircle className="h-7 w-7 text-amber-400" />
          <div>
            <div className="text-sm font-semibold">无法预览模块文档</div>
            <div className={`mt-1 max-w-2xl break-words text-xs leading-5 ${mutedClass}`}>{error}</div>
          </div>
          <button
            type="button"
            onClick={() => setReloadToken(value => value + 1)}
            className={`inline-flex min-h-8 items-center gap-1.5 rounded border px-3 text-xs ${borderClass} ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            重试
          </button>
        </div>
      )}

      {!isLoading && document && (
        <div className="min-w-0 px-5 py-4">
          {document.format === 'markdown' ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              skipHtml
              components={{
                h1: props => <h1 className={`mb-4 border-b pb-2 text-2xl font-semibold ${borderClass}`} {...props} />,
                h2: props => <h2 className={`mb-3 mt-7 border-b pb-1.5 text-xl font-semibold ${borderClass}`} {...props} />,
                h3: props => <h3 className="mb-2 mt-6 text-base font-semibold" {...props} />,
                h4: props => <h4 className="mb-2 mt-5 text-sm font-semibold" {...props} />,
                p: props => <p className={`my-3 break-words text-sm leading-7 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`} {...props} />,
                ul: props => <ul className="my-3 list-disc space-y-1 pl-6 text-sm leading-6" {...props} />,
                ol: props => <ol className="my-3 list-decimal space-y-1 pl-6 text-sm leading-6" {...props} />,
                blockquote: props => <blockquote className={`my-4 border-l-4 border-sky-500/50 px-4 py-1 ${mutedClass}`} {...props} />,
                hr: props => <hr className={`my-6 border-0 border-t ${borderClass}`} {...props} />,
                pre: props => <pre className={`my-4 overflow-x-auto rounded border p-3 text-xs leading-6 ${borderClass} ${isDarkMode ? 'bg-black/25 text-slate-200' : 'bg-slate-50 text-slate-800'}`} {...props} />,
                code: props => <code className={`rounded px-1 py-0.5 font-mono text-[0.9em] ${isDarkMode ? 'bg-white/10' : 'bg-slate-100'}`} {...props} />,
                table: props => <div className={`my-4 overflow-x-auto rounded border ${borderClass}`}><table className="w-full min-w-[560px] border-collapse text-left text-sm" {...props} /></div>,
                thead: props => <thead className={isDarkMode ? 'bg-white/5' : 'bg-slate-100'} {...props} />,
                th: props => <th className={`border-b px-3 py-2 font-semibold ${borderClass}`} {...props} />,
                td: props => <td className={`border-b px-3 py-2 align-top ${borderClass}`} {...props} />,
                a: ({ href, children, ...props }) => {
                  const declaredPath = resolveDeclaredDocumentLink(document.path, href, declaredPathByLink);
                  if (declaredPath) {
                    return <button type="button" className="inline text-sky-400 underline hover:text-sky-300" onClick={() => onOpenDocument(declaredPath)}>{children}</button>;
                  }
                  if (isSafeExternalLink(href)) {
                    return <a href={href} target="_blank" rel="noreferrer" className="text-sky-400 underline hover:text-sky-300" {...props}>{children}</a>;
                  }
                  return <span className="text-slate-400" title="该相对链接未声明为模块公开文档">{children}</span>;
                },
                img: ({ alt }) => <span className={`inline-flex items-center gap-1 text-xs ${mutedClass}`}><ImageOff className="h-3.5 w-3.5" />{alt || '文档图片'}</span>
              }}
            >
              {document.content}
            </ReactMarkdown>
          ) : (
            <pre className={`overflow-x-auto whitespace-pre-wrap break-words rounded border p-4 font-mono text-xs leading-6 ${borderClass} ${isDarkMode ? 'bg-black/25 text-slate-200' : 'bg-slate-50 text-slate-800'}`}>
              {document.content}
            </pre>
          )}
        </div>
      )}
    </section>
  );
}

function normalizeDocumentPath(value: string): string {
  return value.trim().replace(/\\/gu, '/');
}

function resolveDeclaredDocumentLink(
  currentDocumentPath: string,
  href: string | undefined,
  declaredPathByLink: ReadonlyMap<string, string>
): string | undefined {
  if (!href || /^[a-z][a-z0-9+.-]*:/iu.test(href) || href.startsWith('//') || href.startsWith('#')) return undefined;
  const cleanHref = href.split(/[?#]/u, 1)[0];
  if (!cleanHref) return undefined;
  const currentParts = normalizeDocumentPath(currentDocumentPath).split('/');
  currentParts.pop();
  const segments: string[] = currentParts;
  for (const segment of normalizeDocumentPath(cleanHref).split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') segments.pop();
    else segments.push(segment);
  }
  return declaredPathByLink.get(segments.join('/'));
}

function isSafeExternalLink(href: string | undefined): boolean {
  return Boolean(href && /^(?:https?:|mailto:)/iu.test(href));
}
