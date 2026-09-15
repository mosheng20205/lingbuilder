import { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FolderOpen,
  FolderPlus,
  Keyboard,
  Maximize2,
  Minimize2,
  Minus,
  RotateCcw,
  Search,
  X
} from 'lucide-react';
import lingBuilderIcon from '../../../image/lingbuilder-ide-icon-v1.png';
import {
  LINGBUILDER_AI_GUIDE_URL,
  LINGBUILDER_COMMANDS_URL,
  LINGBUILDER_DISPLAY_VERSION,
  LINGBUILDER_DOCS_URL,
  LINGBUILDER_GITHUB_URL,
  LINGBUILDER_VIDEO_TUTORIALS_URL
} from '../services/product/productInfo';
import ProjectTypeDialog from './ProjectTypeDialog';
import RecentWorkspacesDialog, { workspaceLabel } from './RecentWorkspacesDialog';

export interface WelcomePageProps {
  isDarkMode: boolean;
  isMaximized: boolean;
  recentWorkspaces: string[];
  currentWorkspacePath?: string;
  onMinimize: () => void | Promise<void>;
  onToggleMaximize: () => void | Promise<void>;
  onClose: () => void | Promise<void>;
  onCreateProject: (projectType: 'windows-ui' | 'windows-dll' | 'windows-console') => void;
  onOpenWorkspace: () => void | Promise<void>;
  onOpenRecentWorkspace: (workspacePath: string) => void | Promise<void>;
  onForgetWorkspace: (workspacePath: string) => void | Promise<void>;
  onContinue: () => void;
  onOpenHelp: () => void;
  onOpenCliGuide: () => void;
}

/** 欢迎页底部官网导航：文案与路径对齐官网导航（cloud/admin/src/websiteNav.ts）。 */
const WELCOME_SITE_LINKS: ReadonlyArray<{ label: string; url: string }> = [
  { label: '使用手册', url: LINGBUILDER_DOCS_URL },
  { label: '视频教程', url: LINGBUILDER_VIDEO_TUTORIALS_URL },
  { label: '命令查找', url: LINGBUILDER_COMMANDS_URL },
  { label: 'AI 教程', url: LINGBUILDER_AI_GUIDE_URL },
  { label: 'GitHub 开源地址', url: LINGBUILDER_GITHUB_URL }
];

export default function WelcomePage({
  isDarkMode,
  isMaximized,
  recentWorkspaces,
  currentWorkspacePath,
  onMinimize,
  onToggleMaximize,
  onClose,
  onCreateProject,
  onOpenWorkspace,
  onOpenRecentWorkspace,
  onForgetWorkspace,
  onContinue,
  onOpenHelp,
  onOpenCliGuide
}: WelcomePageProps) {
  const [showProjectTypeDialog, setShowProjectTypeDialog] = useState(false);
  const [workspaceQuery, setWorkspaceQuery] = useState('');
  const [showAllWorkspacesDialog, setShowAllWorkspacesDialog] = useState(false);
  const surface = isDarkMode ? 'bg-[#1e1e1e] text-[#d4d4d4]' : 'bg-[#f7f8fa] text-slate-800';
  const titleBar = isDarkMode
    ? 'bg-[#323233] text-slate-200 border-[#2b2b2b]'
    : 'bg-[#f3f3f3] text-slate-800 border-slate-200';
  const panel = isDarkMode ? 'border-[#35353d] bg-[#25252b]' : 'border-slate-200 bg-white';
  const muted = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const subtle = isDarkMode ? 'text-slate-500' : 'text-slate-400';
  const lastWorkspace = currentWorkspacePath || recentWorkspaces[0];
  const workspaceKeyword = workspaceQuery.trim().toLowerCase();
  const filteredWorkspaces = workspaceKeyword
    ? recentWorkspaces.filter(workspacePath => workspacePath.toLowerCase().includes(workspaceKeyword))
    : recentWorkspaces;
  const visibleWorkspaces = workspaceKeyword ? filteredWorkspaces : filteredWorkspaces.slice(0, 6);

  return (
    <div className={`flex h-screen w-screen flex-col overflow-hidden font-sans select-none ${surface}`}>
      <div
        onDoubleClick={() => { void onToggleMaximize(); }}
        className={`window-drag-region flex h-8 shrink-0 items-center justify-between border-b pl-3 pr-0 text-[12px] ${titleBar}`}
      >
        <div className="flex min-w-0 items-center gap-2">
          <img
            src={lingBuilderIcon}
            alt="LingBuilder"
            draggable={false}
            className="h-5 w-5 shrink-0 rounded-[4px] object-contain"
          />
          <span className="truncate font-bold tracking-wide text-[#007acc]">
            LingBuilder <span className="font-normal text-cyan-400/80">{LINGBUILDER_DISPLAY_VERSION}</span>
          </span>
        </div>
        <div className="window-no-drag flex h-full items-stretch">
          <button type="button" title="最小化" aria-label="最小化" onClick={() => { void onMinimize(); }} className={`flex w-11 cursor-pointer items-center justify-center transition-colors ${isDarkMode ? 'hover:bg-[#454548]' : 'hover:bg-slate-200'}`}>
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button type="button" title={isMaximized ? '还原' : '最大化'} aria-label={isMaximized ? '还原' : '最大化'} onClick={() => { void onToggleMaximize(); }} className={`flex w-11 cursor-pointer items-center justify-center transition-colors ${isDarkMode ? 'hover:bg-[#454548]' : 'hover:bg-slate-200'}`}>
            {isMaximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
          <button type="button" title="关闭" aria-label="关闭" onClick={() => { void onClose(); }} className="flex w-11 cursor-pointer items-center justify-center transition-colors hover:bg-rose-600 hover:text-white">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <main className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-6 py-10 lg:px-12 lg:py-14">
          <div className="grid flex-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.86fr)] lg:items-start lg:gap-16">
            <section className="flex min-h-[360px] flex-col justify-center">
              <div className="mb-6 flex items-center gap-3">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl border ${isDarkMode ? 'border-blue-400/30 bg-blue-500/10' : 'border-blue-200 bg-blue-50'}`}>
                  <img src={lingBuilderIcon} alt="" draggable={false} className="h-8 w-8 rounded-lg object-contain" />
                </div>
                <div>
                  <div className={`text-[11px] uppercase tracking-[0.18em] ${subtle}`}>LINGBUILDER IDE</div>
                  <div className="text-sm font-semibold">中文 C++ 工作台</div>
                </div>
              </div>

              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">欢迎使用 LingBuilder</h1>
              <p className={`mt-3 max-w-xl text-sm leading-6 ${muted}`}>
                从一个工作区开始，创建、打开或继续你的中文 C++ 项目。
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setShowProjectTypeDialog(true)}
                  className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md bg-[#007acc] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#168ad4] focus:outline-none focus:ring-2 focus:ring-blue-400/60"
                >
                  <FolderPlus className="h-4 w-4" />
                  新建项目
                </button>
                <button
                  type="button"
                  onClick={() => { void onOpenWorkspace(); }}
                  className={`inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border px-4 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400/60 ${isDarkMode ? 'border-[#4a4a54] bg-[#292930] text-slate-100 hover:border-blue-400/70 hover:bg-[#30303a]' : 'border-slate-300 bg-white text-slate-700 hover:border-blue-400 hover:bg-blue-50'}`}
                >
                  <FolderOpen className="h-4 w-4" />
                  打开工作区
                </button>
              </div>

              <button
                type="button"
                onClick={onContinue}
                className={`mt-5 flex max-w-xl cursor-pointer items-center gap-3 rounded-md border px-4 py-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400/60 ${panel} ${isDarkMode ? 'hover:border-blue-400/60 hover:bg-[#2b2b34]' : 'hover:border-blue-400 hover:bg-blue-50/60'}`}
              >
                <RotateCcw className="h-4 w-4 shrink-0 text-amber-500" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">继续上次工作</span>
                  <span className={`mt-0.5 block truncate text-xs ${muted}`} title={lastWorkspace || '当前默认工作区'}>
                    {lastWorkspace || '当前默认工作区'}
                  </span>
                </span>
                <ArrowRight className={`h-4 w-4 shrink-0 ${muted}`} />
              </button>
            </section>

            <section className="space-y-4">
              <div className={`border-b pb-3 ${isDarkMode ? 'border-[#35353d]' : 'border-slate-200'}`}>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Clock3 className="h-4 w-4 text-blue-400" />
                  最近工作区
                </div>
                <div className={`mt-1 text-xs ${muted}`}>选择一个项目继续编辑。</div>
              </div>

              <div className="space-y-3">
                {recentWorkspaces.length > 0 && (
                  <div className="relative">
                    <Search className={`pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                    <input
                      type="text"
                      value={workspaceQuery}
                      onChange={event => setWorkspaceQuery(event.target.value)}
                      placeholder="搜索工作区名称或路径…"
                      aria-label="搜索最近工作区"
                      data-welcome-workspace-search
                      className={`h-9 w-full rounded-md border pl-9 pr-8 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400/60 ${
                        isDarkMode
                          ? 'border-[#3d3d44] bg-[#1b1b21] text-slate-200 placeholder:text-slate-500'
                          : 'border-slate-300 bg-white text-slate-800 placeholder:text-slate-400'
                      }`}
                    />
                    {workspaceQuery && (
                      <button
                        type="button"
                        title="清空搜索"
                        aria-label="清空工作区搜索"
                        onClick={() => setWorkspaceQuery('')}
                        className={`absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded transition-colors ${isDarkMode ? 'text-slate-500 hover:bg-[#303038] hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-900'}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}

                {recentWorkspaces.length > 0 ? (
                  visibleWorkspaces.length > 0 ? visibleWorkspaces.map(workspacePath => (
                    <button
                      type="button"
                      key={workspacePath}
                      title={workspacePath}
                      data-welcome-recent-workspace={workspacePath}
                      onClick={() => { void onOpenRecentWorkspace(workspacePath); }}
                      className={`group flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-md border px-3 py-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400/60 ${panel} ${isDarkMode ? 'hover:border-blue-400/60 hover:bg-[#2b2b34]' : 'hover:border-blue-400 hover:bg-blue-50/60'}`}
                    >
                      <FolderOpen className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-blue-400" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{workspaceLabel(workspacePath)}</span>
                        <span className={`mt-0.5 block truncate text-[11px] ${subtle}`}>{workspacePath}</span>
                      </span>
                      <ChevronRight className={`h-4 w-4 shrink-0 ${subtle} group-hover:text-blue-400`} />
                    </button>
                  )) : (
                    <div className={`rounded-md border border-dashed px-4 py-8 text-center text-xs ${isDarkMode ? 'border-[#45454e] text-slate-500' : 'border-slate-300 text-slate-400'}`}>
                      没有匹配「{workspaceQuery.trim()}」的工作区
                    </div>
                  )
                ) : (
                  <div className={`rounded-md border border-dashed px-4 py-8 text-center text-xs ${isDarkMode ? 'border-[#45454e] text-slate-500' : 'border-slate-300 text-slate-400'}`}>
                    暂无最近工作区
                  </div>
                )}

                {recentWorkspaces.length > 6 && (
                  <button
                    type="button"
                    data-welcome-show-all-workspaces
                    onClick={() => setShowAllWorkspacesDialog(true)}
                    className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed px-3 py-2.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400/60 ${
                      isDarkMode
                        ? 'border-[#45454e] text-slate-400 hover:border-blue-400/60 hover:bg-[#2b2b34] hover:text-blue-300'
                        : 'border-slate-300 text-slate-500 hover:border-blue-400 hover:bg-blue-50/60 hover:text-blue-700'
                    }`}
                  >
                    查看全部（共 {recentWorkspaces.length} 个）…
                  </button>
                )}
              </div>

              <div className={`grid grid-cols-2 gap-2 border-t pt-4 ${isDarkMode ? 'border-[#35353d]' : 'border-slate-200'}`}>
                <button type="button" onClick={onOpenHelp} className={`flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-xs transition-colors ${isDarkMode ? 'text-slate-300 hover:bg-[#2b2b34] hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>
                  <BookOpen className="h-3.5 w-3.5" />
                  帮助文档
                </button>
                <button type="button" onClick={onOpenCliGuide} className={`flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-xs transition-colors ${isDarkMode ? 'text-slate-300 hover:bg-[#2b2b34] hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>
                  <Keyboard className="h-3.5 w-3.5" />
                  快捷键与命令
                </button>
              </div>

              <div className={`flex items-center gap-2 text-[11px] ${subtle}`}>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                本地工作区已准备就绪
              </div>
            </section>
          </div>

          <footer className={`mt-10 flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-[11px] ${isDarkMode ? 'border-[#35353d] text-slate-500' : 'border-slate-200 text-slate-400'}`}>
            <nav aria-label="官网导航" className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {WELCOME_SITE_LINKS.map(link => (
                <button
                  type="button"
                  key={link.url}
                  title={link.url}
                  onClick={() => window.open(link.url, '_blank', 'noopener,noreferrer')}
                  className="cursor-pointer transition-colors hover:text-blue-400 hover:underline focus:outline-none focus-visible:text-blue-400 focus-visible:underline"
                >
                  {link.label}
                </button>
              ))}
            </nav>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />本地模式</span>
          </footer>
        </div>
      </main>

      <RecentWorkspacesDialog
        open={showAllWorkspacesDialog}
        isDarkMode={isDarkMode}
        recentWorkspaces={recentWorkspaces}
        initialQuery={workspaceQuery}
        onOpenWorkspace={workspacePath => {
          setShowAllWorkspacesDialog(false);
          void onOpenRecentWorkspace(workspacePath);
        }}
        onForgetWorkspace={workspacePath => { void onForgetWorkspace(workspacePath); }}
        onClose={() => setShowAllWorkspacesDialog(false)}
      />

      <ProjectTypeDialog
        open={showProjectTypeDialog}
        isDarkMode={isDarkMode}
        onSelectWindowsUi={() => {
          setShowProjectTypeDialog(false);
          onCreateProject('windows-ui');
        }}
        onSelectWindowsDll={() => {
          setShowProjectTypeDialog(false);
          onCreateProject('windows-dll');
        }}
        onSelectWindowsConsole={() => {
          setShowProjectTypeDialog(false);
          onCreateProject('windows-console');
        }}
        onClose={() => setShowProjectTypeDialog(false)}
      />
    </div>
  );
}
