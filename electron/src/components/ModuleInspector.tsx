import React, { useState, useEffect } from 'react';
import {
  Layers,
  FolderOpen,
  Download,
  FolderSync,
  Upload,
  RefreshCw,
  Search,
  Check,
  X,
  Play,
  RotateCcw,
  BookOpen,
  Info,
  ShieldAlert,
  ArrowUp,
  ArrowDown,
  Trash2,
  ExternalLink,
  Bot,
  Copy,
  Eye,
  FileText,
  FileCode,
  Sparkles,
  HelpCircle,
  Settings,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Maximize2
} from 'lucide-react';

interface ModuleInspectorProps {
  onAddLog: (log: string) => void;
  isDarkMode?: boolean;
}

// Interfaces for our interactive model
interface LocalModule {
  id: string;
  name: string;
  type: string;
  version: string;
  status: string;
  isEnabled: boolean;
  description: string;
  entry: string;
  compatibility: string;
  dependencies: string[];
  capabilities: string[];
  runtimeAdaptation: string;
  permissions: string[];
  authorized: boolean;
  cppDependencies: string[];
  error?: string;
  diagnostic?: string;
}

interface ComponentStatus {
  id: string;
  name: string;
  type: string;
  source: string;
  status: 'active' | 'pending' | 'error';
  factory: string;
  signature: string;
  namespace: string;
  headerFile: string;
}

interface OperationHistory {
  id: string;
  action: string;
  moduleName: string;
  version: string;
  time: string;
  snapshotPath?: string;
}

interface MarketSource {
  id: string;
  name: string;
  type: 'local' | 'official' | 'enterprise';
  isEnabled: boolean;
  location: string;
  priority: number;
  health: 'ok' | 'offline' | 'error';
  status: 'ready' | 'refreshing' | 'failed';
}

interface MarketSourceRefreshLog {
  id: string;
  time: string;
  sourceName: string;
  status: 'success' | 'failed' | 'cancelled';
  details: string;
}

interface PolicyHistory {
  id: string;
  time: string;
  action: '导入' | '恢复';
  mode: '覆盖导入' | '合并导入' | '回滚快照';
  sourceName: string;
  details: string;
  changesBefore: string;
  changesAfter: string;
}

interface MarketModule {
  id: string;
  name: string;
  type: string;
  version: string;
  versionPolicy: string;
  description: string;
  publisher: string;
  trustState: 'official' | 'trusted' | 'unknown';
  tags: string[];
  downloads: number;
  rating: number;
  updateTime: string;
  localVersion?: string;
  packagePath: string;
  downloadUrl: string;
  sha256: string;
  updateUrl: string;
  mirrors: { name: string; url: string }[];
  readmeMarkdown: string;
  screenshots: string[];
  dependenciesPolicy: string;
}

interface InstallHistory {
  id: string;
  moduleName: string;
  time: string;
  status: 'success' | 'failed' | 'rollback';
  summary: string;
  details: string;
}

export default function ModuleInspector({ onAddLog, isDarkMode = true }: ModuleInspectorProps) {
  // ---------------- STATE DEFINITIONS ----------------

  // Local module status list
  const [localModules, setLocalModules] = useState<LocalModule[]>([
    {
      id: 'mod_utf8_std',
      name: '原生中文 UTF-8 底层支持包',
      type: 'C++ 依赖',
      version: 'v1.4.2',
      status: '就绪',
      isEnabled: true,
      description: '提供 Windows 平台 MSVC 编译器底层中文宽字符及 UTF-8 代码自动转换及编译路由拦截支撑。',
      entry: 'utf8_std_entry.h',
      compatibility: 'MSVC v143+, Windows SDK 10.0+',
      dependencies: [],
      capabilities: ['宽字符流转换', '中文标识符映射'],
      runtimeAdaptation: '自动挂载运行时拦截器',
      permissions: ['文件读写', '系统进程映射'],
      authorized: true,
      cppDependencies: ['std_locale_patch.lib'],
      diagnostic: '一切正常。已绑定到 cl.exe。'
    },
    {
      id: 'mod_wpf_cn_controls',
      name: 'LingBuilder 基础中文 UI 组件包',
      type: 'UI 组件',
      version: 'v2.1.0',
      status: '就绪',
      isEnabled: true,
      description: '包含常用的“按钮”、“文本标签”、“输入框”等高度汉化版的原生可视化 WPF/C++ 封装。',
      entry: 'WpfCnControls.dll',
      compatibility: 'LingBuilder IDE v2.0+',
      dependencies: ['mod_utf8_std'],
      capabilities: ['中文矢量绘制', '动态数据绑定'],
      runtimeAdaptation: 'LingBuilder UI 工厂契约 v2',
      permissions: ['图形子系统驱动', '剪贴板访问'],
      authorized: true,
      cppDependencies: ['WpfCnControls.lib', 'WpfCnControls.h']
    },
    {
      id: 'mod_browser_edge',
      name: 'Edge 内核 WebView2 中文浏览器适配器',
      type: '浏览器适配',
      version: 'v1.0.8',
      status: '依赖缺失',
      isEnabled: false,
      description: '使得 C++ 中文程序能一键嵌入 Edge Chromium 内核浏览器组件，并支持双向数据通道。',
      entry: 'EdgeAdapter.dll',
      compatibility: 'WebView2 Runtime 110.0+',
      dependencies: ['mod_wpf_cn_controls', 'mod_missing_edge_core'],
      capabilities: ['HTML5 渲染', 'JS-Cpp 双向 RPC'],
      runtimeAdaptation: 'WebView2 运行时桥接',
      permissions: ['网络套接字', '本地文件虚拟重定向'],
      authorized: false,
      cppDependencies: ['WebView2Loader.dll'],
      error: '缺少依赖项: mod_missing_edge_core (Edge 核心动态库)'
    }
  ]);

  // Component Status (displays active controls placeholder)
  const [componentStatuses, setComponentStatuses] = useState<ComponentStatus[]>([
    {
      id: 'comp_btn_01',
      name: '立即安全登录账户',
      type: 'Button',
      source: 'LingBuilder 基础中文 UI 组件包',
      status: 'active',
      factory: 'WpfCnControls!CreateChineseButton',
      signature: 'HWND CreateChineseButton(LPCWSTR text, int w, int h)',
      namespace: 'LingBuilder::Controls',
      headerFile: 'WpfCnControls.h'
    },
    {
      id: 'comp_lbl_01',
      name: '太空冒险 (Space Adventure) 客户端',
      type: 'Label',
      source: 'LingBuilder 基础中文 UI 组件包',
      status: 'active',
      factory: 'WpfCnControls!CreateChineseLabel',
      signature: 'HWND CreateChineseLabel(LPCWSTR text, int w, int h)',
      namespace: 'LingBuilder::Controls',
      headerFile: 'WpfCnControls.h'
    },
    {
      id: 'comp_browser_01',
      name: '星际资讯公告板',
      type: 'Image', // Represents standard viewport placeholder in designer
      source: 'Edge 内核 WebView2 中文浏览器适配器',
      status: 'error',
      factory: 'EdgeAdapter!CreateWebViewContainer',
      signature: 'HWND CreateWebViewContainer(HWND parent, LPCWSTR initialUrl)',
      namespace: 'LingBuilder::Web',
      headerFile: 'EdgeAdapter.h'
    }
  ]);

  // Module Operation History
  const [operationHistories, setOperationHistories] = useState<OperationHistory[]>([
    {
      id: 'hist_01',
      action: '安装',
      moduleName: '原生中文 UTF-8 底层支持包',
      version: 'v1.4.2',
      time: '2026-06-29 10:12:44',
      snapshotPath: 'snapshots/mod_utf8_std_v1.4.2_backup.zip'
    },
    {
      id: 'hist_02',
      action: '更新',
      moduleName: 'LingBuilder 基础中文 UI 组件包',
      version: 'v2.1.0',
      time: '2026-06-29 12:40:15',
      snapshotPath: 'snapshots/mod_wpf_cn_controls_v2.0.9_rollback.zip'
    }
  ]);

  // Market Sources
  const [marketSources, setMarketSources] = useState<MarketSource[]>([
    {
      id: 'src_official',
      name: 'LingBuilder 官方中文组件市场',
      type: 'official',
      isEnabled: true,
      location: 'https://market.lingbuilder.cn/v2/api',
      priority: 1,
      health: 'ok',
      status: 'ready'
    },
    {
      id: 'src_local',
      name: '本地离线模块缓冲源',
      type: 'local',
      isEnabled: true,
      location: 'modules/module-market.json',
      priority: 2,
      health: 'ok',
      status: 'ready'
    },
    {
      id: 'src_enterprise',
      name: '星际联盟企业私有模块仓',
      type: 'enterprise',
      isEnabled: false,
      location: 'https://private.space-alliance.org/modules',
      priority: 3,
      health: 'offline',
      status: 'ready'
    }
  ]);

  // Source Refresh Progress / Logs
  const [refreshProgressText, setRefreshProgressText] = useState('暂无刷新任务。');
  const [isRefreshingSources, setIsRefreshingSources] = useState(false);
  const [autoRefreshOnStartup, setAutoRefreshOnStartup] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(false);
  const [autoRefreshFailedOnly, setAutoRefreshFailedOnly] = useState(false);
  const [autoRefreshIntervalMinutes, setAutoRefreshIntervalMinutes] = useState('30');
  const [autoRefreshStrategyText, setAutoRefreshStrategyText] = useState('自动刷新当前关闭。');

  // Search box states
  const [sourceRefreshHistorySearch, setSourceRefreshHistorySearch] = useState('');
  const [sourceRefreshHistoryStateFilter, setSourceRefreshHistoryStateFilter] = useState('全部刷新');
  const [refreshLogs, setRefreshLogs] = useState<MarketSourceRefreshLog[]>([
    { id: 'ref_01', time: '2026-06-29 09:30:00', sourceName: 'LingBuilder 官方中文组件市场', status: 'success', details: '扫描到 42 个可用模块，耗时 1.25s。' },
    { id: 'ref_02', time: '2026-06-29 09:30:01', sourceName: '本地离线模块缓冲源', status: 'success', details: '扫描到本地 5 个离线离岸支持包。' },
    { id: 'ref_03', time: '2026-06-29 09:30:03', sourceName: '星际联盟企业私有模块仓', status: 'failed', details: '连接超时错误 (code: 10060)。网络处于隔离状态。' }
  ]);

  // Policy histories
  const [policyHistorySearch, setPolicyHistorySearch] = useState('');
  const [policyHistoryActionFilter, setPolicyHistoryActionFilter] = useState('全部操作');
  const [policyHistoryTimeFilter, setPolicyHistoryTimeFilter] = useState('全部时间');
  const [policyHistoryModeFilter, setPolicyHistoryModeFilter] = useState('全部模式');
  const [policyHistories, setPolicyHistories] = useState<PolicyHistory[]>([
    {
      id: 'pol_01',
      time: '2026-06-29 08:15:30',
      action: '导入',
      mode: '覆盖导入',
      sourceName: 'LingBuilder 官方中文组件市场',
      details: '导入了 3 个官方推荐镜像分发加速配置策略。',
      changesBefore: '优先级: 官方(1), 本地(2), 企业(3)',
      changesAfter: '新增 2 个阿里云镜像及腾讯云镜像加速通道'
    },
    {
      id: 'pol_02',
      time: '2026-06-29 09:44:12',
      action: '恢复',
      mode: '回滚快照',
      sourceName: '星际联盟企业私有模块仓',
      details: '恢复先前备份的企业验证安全网关。',
      changesBefore: '禁用网关',
      changesAfter: '启用了 SSL 企业证书双向认证校验通道'
    }
  ]);

  const [policyHistoryFolded, setPolicyHistoryFolded] = useState<Record<string, boolean>>({});
  const [activePolicyDetail, setActivePolicyDetail] = useState<PolicyHistory | null>(null);
  const [policyExportPreviewText, setPolicyExportPreviewText] = useState<string | null>(null);

  // Market Main Search & Filters
  const [marketSearchQuery, setMarketSearchQuery] = useState('');
  const [marketTypeFilter, setMarketTypeFilter] = useState('全部类型');
  const [marketStateFilter, setMarketStateFilter] = useState('全部状态');
  const [marketStatusText, setMarketStatusText] = useState('已成功载入模块市场缓存库。');

  // Market module dataset
  const [marketModules, setMarketModules] = useState<MarketModule[]>([
    {
      id: 'mod_ai_optimizer',
      name: 'Gemini 智能中文代码重构优化器',
      type: 'AI Agent',
      version: 'v3.5.0',
      versionPolicy: '滚动更新 (最新版推荐)',
      description: '接入谷歌 AI Studio Gemini 3.5 核心引擎，智能提取 C++ 局部常量中文词汇，批量提供汉化方案，并自动进行占位符和编译断言格式对齐。',
      publisher: 'Google DeepMind AI Build Team',
      trustState: 'official',
      tags: ['AI', '代码优化', '智能映射'],
      downloads: 14590,
      rating: 4.9,
      updateTime: '2026-06-29 15:30:22',
      localVersion: undefined,
      packagePath: 'packages/gemini_ai_optimizer_v3.5.0.lbp',
      downloadUrl: 'https://dl.lingbuilder.cn/packages/gemini_ai_optimizer.lbp',
      sha256: 'B4A28CE0622C997A13B44D87E60706226B221E72A708060B1E60613BD1ED14A2',
      updateUrl: 'https://market.lingbuilder.cn/update/gemini_ai_optimizer',
      mirrors: [
        { name: '北京阿里云节点', url: 'https://mirror.aliyun.lingbuilder.cn/gemini_ai_optimizer.lbp' },
        { name: '深圳腾讯云节点', url: 'https://mirror.tencent.lingbuilder.cn/gemini_ai_optimizer.lbp' }
      ],
      readmeMarkdown: `# Gemini 智能中文代码重构优化器

本模块旨在结合 **Gemini 3.5 智能接口** 实现完全意义上的中文化编译。

## 主要功能点

1. **智能汉化分析**：一键扫描英文代码，精准汉化文本资源；
2. **占位符完美对齐**：智能识别 \`%s\`, \`%d\` 格式化占位，避免翻译不当引发崩溃；
3. **中文事件委托机制**：可视化建立符合国人习惯的类和回调命名规范。

## 兼容说明

- 完美兼容 **LingBuilder IDE v2.0+**
- 支持 **MSVC v143 及以上** 原生平台编译器。`,
      screenshots: [
        'https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=500&auto=format&fit=crop&q=60',
        'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=500&auto=format&fit=crop&q=60'
      ],
      dependenciesPolicy: '自动下载缺失的基础 UTF-8 依赖包 (v1.4.0+)'
    },
    {
      id: 'mod_chart_d3_cpp',
      name: 'D3 中文可视化矢量图表渲染包',
      type: 'UI 组件',
      version: 'v1.2.0',
      versionPolicy: '固定主版本',
      description: '提供原生 C++ 下对 D3 中文图表（折线图、柱状图、雷达图）的高动态渲染绑定，完美融合 Windows 图形底层驱动。',
      publisher: 'LingBuilder 社区开源组',
      trustState: 'trusted',
      tags: ['D3', '数据图表', '矢量画刷'],
      downloads: 4210,
      rating: 4.7,
      updateTime: '2026-06-25 11:20:00',
      localVersion: 'v1.1.9',
      packagePath: 'packages/d3_chart_cpp_v1.2.0.lbp',
      downloadUrl: 'https://dl.lingbuilder.cn/packages/d3_chart_cpp_v1.2.0.lbp',
      sha256: 'FA73C99F128E62211C81CEE640B22FCEF09228CE99B1E60613BD1ED1440DE1E1',
      updateUrl: 'https://market.lingbuilder.cn/update/d3_chart_cpp',
      mirrors: [],
      readmeMarkdown: `# D3 中文可视化矢量图表组件

高性能、零垃圾内存损耗的矢量图表 C++ 类包，内置强大的中文标注和数据同步绑定功能。

- 雷达图、极坐标图全支持
- 完美匹配中文 UTF-8 标识`,
      screenshots: [
        'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=500&auto=format&fit=crop&q=60'
      ],
      dependenciesPolicy: '依赖标准 Windows SDK 图形驱动库'
    }
  ]);

  // Market Install History
  const [installHistorySearch, setInstallHistorySearch] = useState('');
  const [installHistoryStateFilter, setInstallHistoryStateFilter] = useState('全部历史');
  const [installHistories, setInstallHistories] = useState<InstallHistory[]>([
    {
      id: 'inst_01',
      moduleName: '原生中文 UTF-8 底层支持包',
      time: '2026-06-29 10:12:00',
      status: 'success',
      summary: '主程序 mod_utf8_std 下载解包并挂载成功。',
      details: '下载大小: 2.14MB. 安装路径: modules/std_utf8_support. 并挂载 cl.exe 钩子，完成了 43 个中文类标头预编译。'
    }
  ]);

  // Collapsible detailed panels states
  const [selectedMarketModule, setSelectedMarketModule] = useState<MarketModule | null>(null);
  const [activeInstallPlan, setActiveInstallPlan] = useState<MarketModule | null>(null);
  const [activeInstallResult, setActiveInstallResult] = useState<{ moduleName: string; status: 'success' | 'failed'; message: string; details: string } | null>(null);

  // Markdown Reader Inner States
  const [markdownDocSearch, setMarkdownDocSearch] = useState('');
  const [markdownDocSearchStatus, setMarkdownDocSearchStatus] = useState('未查找');
  const [markdownDocCopyStatus, setMarkdownDocCopyStatus] = useState('未复制');
  const [markdownDocFolded, setMarkdownDocFolded] = useState(true);

  // AI Context Panel States
  const [aiDocSearchStatus, setAiDocSearchStatus] = useState('未发送');
  const [aiFilterModule, setAiFilterModule] = useState('全部模块');
  const [aiFilterDoc, setAiFilterDoc] = useState('全部文档');
  const [aiFilterType, setAiFilterType] = useState('全部类型');
  const [aiContexts, setAiContexts] = useState([
    { id: 'ctx_01', time: '2026-06-29 15:44:00', module: 'Gemini 智能重构', doc: 'README.md', type: '功能陈述', length: 245, summary: 'Gemini 3.5 智能模型对中文映射的极速转译机制及安全性。' },
    { id: 'ctx_02', time: '2026-06-29 15:45:10', module: 'Gemini 智能重构', doc: 'QuickStart.md', type: '事件委托', length: 180, summary: '基于 C++ 中文类定义、中文属性命名与底层委托方法的快速构建路由。' }
  ]);

  // AI Import Reports History
  const [aiReportSearch, setAiReportSearch] = useState('');
  const [aiReportStatusFilter, setAiReportStatusFilter] = useState('全部报告');
  const [aiReports, setAiReports] = useState([
    { id: 'rep_01', time: '2026-06-29 11:30:15', actual: 4, added: 4, updated: 0, skipped: 0, module: 'Gemini 智能重构', doc: '全套官方 API 契约手册' }
  ]);
  const [aiReportExportPreviewText, setAiReportExportPreviewText] = useState<string | null>(null);

  // Custom Data Desensitization Rules inside AI context
  const [selectedDesensitizationRuleGroup, setSelectedDesensitizationRuleGroup] = useState('通用加密防护');
  const desensitizationRules = [
    { group: '通用加密防护', name: '去除账号/敏感 API 秘钥信息', regex: 'API_KEY=[a-zA-Z0-9_-]{32}', status: '自动激活' },
    { group: '通用加密防护', name: '中文标识名保留，混淆内外部硬件注册地址', regex: '0x[a-fA-F0-9]{8,16}', status: '自动激活' },
    { group: 'C++ 内外部脱敏', name: '脱敏机器路径及本地域名称', regex: 'C:\\\\Users\\\\[a-zA-Z0-9_]+\\\\', status: '自动激活' }
  ];

  // Screenshot Zoom-in modal
  const [activeZoomedScreenshot, setActiveZoomedScreenshot] = useState<{ list: string[]; index: number } | null>(null);
  const [screenshotScale, setScreenshotScale] = useState(100);

  // ---------------- OPERATIONS / ACTIONS ----------------

  // Local module triggers
  const handleToggleModule = (id: string) => {
    setLocalModules(prev => prev.map(m => {
      if (m.id === id) {
        const nextState = !m.isEnabled;
        onAddLog(`> [${new Date().toLocaleTimeString()}] 【模块】已${nextState ? '启用' : '禁用'}本地模块: ${m.name}`);
        return { ...m, isEnabled: nextState, status: nextState ? '就绪' : '已禁用' };
      }
      return m;
    }));
  };

  const handleUninstallModule = (id: string, name: string) => {
    if (confirm(`确认要彻底卸载本地模块 [${name}] 吗？`)) {
      setLocalModules(prev => prev.filter(m => m.id !== id));
      onAddLog(`> [${new Date().toLocaleTimeString()}] 【模块】成功卸载本地模块: ${name}. 并归档了可回滚快照。`);
      setOperationHistories(prev => [
        {
          id: `hist_${Date.now()}`,
          action: '卸载',
          moduleName: name,
          version: 'v1.0.0',
          time: new Date().toISOString().replace('T', ' ').substring(0, 19),
          snapshotPath: `snapshots/mod_uninstalled_${id}_snapshot.zip`
        },
        ...prev
      ]);
    }
  };

  const handleInstallMissingDependencies = (m: LocalModule) => {
    onAddLog(`> [${new Date().toLocaleTimeString()}] 【模块】正在连接官方云仓库，一键安装 [${m.name}] 缺失的全部底层 C++ 依赖及关联模块...`);
    setTimeout(() => {
      setLocalModules(prev => prev.map(item => {
        if (item.id === m.id) {
          return { ...item, status: '就绪', error: undefined };
        }
        return item;
      }));
      onAddLog(`> [${new Date().toLocaleTimeString()}] 【模块】[${m.name}] 的全部 C++ 原生链接库和版本重置策略安装完毕！当前状态已更新为“就绪”。`);
    }, 1200);
  };

  const handleShowCapabilityDetails = (m: LocalModule) => {
    alert(`【${m.name}】模块能力详情:\n\n` +
      `- 模块 ID: ${m.id}\n` +
      `- 入口头文件: ${m.entry}\n` +
      `- 运行时工厂契约: ${m.runtimeAdaptation}\n` +
      `- 声明权限列表: ${m.permissions.join(', ') || '无'}\n` +
      `- 授权验证状态: ${m.authorized ? '已通过数字证书授权' : '尚未授权'}\n` +
      `- C++ 原生库依赖: ${m.cppDependencies.join(', ') || '无'}\n\n` +
      `诊断及状态: ${m.error || m.diagnostic || '暂无异常诊断。'}`
    );
  };

  // Local Toolbar handlers
  const handleLocalRefresh = () => {
    onAddLog(`> [${new Date().toLocaleTimeString()}] 【模块】正在重新扫描 modules/ 目录下的 module.json 模块规约清单...`);
    setTimeout(() => {
      onAddLog(`> [${new Date().toLocaleTimeString()}] 【模块】重新读取完毕。共载入 3 项模块，2 项就绪，1 项诊断失败。`);
    }, 500);
  };

  // Auto refresh strategy setting
  const handleApplyAutoRefreshSettings = () => {
    const activeStr = [
      autoRefreshOnStartup ? '启动后刷新' : '',
      autoRefreshInterval ? `每隔 ${autoRefreshIntervalMinutes} 分钟定时刷新` : '',
      autoRefreshFailedOnly ? '仅对失败的源进行探测' : ''
    ].filter(Boolean).join(', ') || '自动刷新关闭';
    setAutoRefreshStrategyText(`当前已应用策略：${activeStr}`);
    onAddLog(`> [${new Date().toLocaleTimeString()}] 【市场源】成功应用了全新的模块市场源探测与自动定时自动刷新策略配置。`);
  };

  // Source management up/down
  const handleMoveSource = (idx: number, direction: 'up' | 'down') => {
    const nextIdx = idx + (direction === 'up' ? -1 : 1);
    if (nextIdx < 0 || nextIdx >= marketSources.length) return;
    const newList = [...marketSources];
    const temp = newList[idx];
    newList[idx] = newList[nextIdx];
    newList[nextIdx] = temp;
    setMarketSources(newList);
    onAddLog(`> [${new Date().toLocaleTimeString()}] 【市场源】调整了源 [${temp.name}] 的加载及优先级排序顺序。`);
  };

  const handleToggleSource = (id: string, name: string) => {
    setMarketSources(prev => prev.map(s => {
      if (s.id === id) {
        const nextState = !s.isEnabled;
        onAddLog(`> [${new Date().toLocaleTimeString()}] 【市场源】已${nextState ? '启用' : '禁用'}源: ${name}`);
        return { ...s, isEnabled: nextState };
      }
      return s;
    }));
  };

  const handleDeleteSource = (id: string, name: string) => {
    if (confirm(`确认彻底删除市场源 [${name}] 吗？`)) {
      setMarketSources(prev => prev.filter(s => s.id !== id));
      onAddLog(`> [${new Date().toLocaleTimeString()}] 【市场源】成功移除了自定义组件市场源: ${name}`);
    }
  };

  const handleRefreshSingleSource = (id: string, name: string) => {
    setMarketSources(prev => prev.map(s => s.id === id ? { ...s, status: 'refreshing' } : s));
    onAddLog(`> [${new Date().toLocaleTimeString()}] 【市场源】开始探测与刷新源网络节点: [${name}] ...`);
    setTimeout(() => {
      setMarketSources(prev => prev.map(s => s.id === id ? { ...s, status: 'ready', health: id === 'src_enterprise' ? 'offline' : 'ok' } : s));
      const isFailed = id === 'src_enterprise';
      setRefreshLogs(prev => [
        {
          id: `ref_${Date.now()}`,
          time: new Date().toISOString().replace('T', ' ').substring(0, 19),
          sourceName: name,
          status: isFailed ? 'failed' : 'success',
          details: isFailed ? '网络重试 3 次均握手失败。' : '拉取组件清单成功，更新了 8 个安装包缓存元数据。'
        },
        ...prev
      ]);
      onAddLog(`> [${new Date().toLocaleTimeString()}] 【市场源】[${name}] 刷新完毕，探测状态: ${isFailed ? '失败' : '成功'}`);
    }, 1200);
  };

  // Batch refresh all market sources
  const handleRefreshAllMarketSources = () => {
    setIsRefreshingSources(true);
    setRefreshProgressText('正在批量连接 3 个内置组件仓及私有源... (33%)');
    onAddLog(`> [${new Date().toLocaleTimeString()}] 【模块市场】开始启动一键批量更新及加速策略拉取...`);
    setTimeout(() => {
      setRefreshProgressText('正向获取最新的哈希一致性哈希包... (66%)');
    }, 800);
    setTimeout(() => {
      setIsRefreshingSources(false);
      setRefreshProgressText('批量更新全部完成！');
      onAddLog(`> [${new Date().toLocaleTimeString()}] 【模块市场】100% 同步就绪。共新增 2 个 AI 组件推荐。`);
    }, 1500);
  };

  // Installation steps: Click Download -> Plan -> Install -> Result
  const handleShowInstallPlan = (m: MarketModule) => {
    setSelectedMarketModule(null); // hide details
    setActiveInstallPlan(m);
    onAddLog(`> [${new Date().toLocaleTimeString()}] 【市场安装】正在为 [${m.name}] 解析环境约束并自动构建安装计划...`);
  };

  const handleExecuteInstall = (m: MarketModule) => {
    setActiveInstallPlan(null);
    onAddLog(`> [${new Date().toLocaleTimeString()}] 【市场安装】正在建立与安装包云连接，下载 [${m.name}] ...`);
    
    // Simulate async download and install
    setTimeout(() => {
      // Add to local modules
      const alreadyHas = localModules.some(item => item.id === m.id);
      if (!alreadyHas) {
        setLocalModules(prev => [
          ...prev,
          {
            id: m.id,
            name: m.name,
            type: m.type,
            version: m.version,
            status: '就绪',
            isEnabled: true,
            description: m.description,
            entry: `${m.id}_header.h`,
            compatibility: 'LingBuilder v2.0+',
            dependencies: [],
            capabilities: ['市场极速注入', '标准事件反射'],
            runtimeAdaptation: '动态重定向及注册回调',
            permissions: ['网络套接字', '安全策略注入'],
            authorized: true,
            cppDependencies: [`${m.id}.lib`, `${m.id}.h`]
          }
        ]);
      }

      setInstallHistories(prev => [
        {
          id: `inst_${Date.now()}`,
          moduleName: m.name,
          time: new Date().toISOString().replace('T', ' ').substring(0, 19),
          status: 'success',
          summary: `安装包 ${m.id} v${m.version} 写入系统 modules 归属成功。`,
          details: `已将 ${m.id} 文件解压同步至 /modules/${m.id}。主类及变量已反射绑定至 C++ 中文编程设计器内核，一键智能汉化能力已扩增。`
        },
        ...prev
      ]);

      // Open installation results
      setActiveInstallResult({
        moduleName: m.name,
        status: 'success',
        message: '模块下载解包并本地预注册完毕！',
        details: `已经完成了：\n1. 包数字签名安全校验：SHA256 比对高度一致。\n2. C++ 标头分析：检测到 2 个类接口，16 个映射词，完美支持智能补全。\n3. 可视化设计器支持：已将适配器属性和 1 个事件占位挂接到 Properties Panel。\n\n当前该模块已自动激活，无需重启 IDE 即可立即在“设计器”或“代码区”双击直接生成调用！`
      });

      onAddLog(`> [${new Date().toLocaleTimeString()}] 【市场安装】恭喜，[${m.name}] 模块已成功入库并挂载到当前 C++ 运行沙盒！`);
    }, 1500);
  };

  // Rollback module back to earlier history version
  const handleRollbackVersion = (hist: OperationHistory) => {
    if (confirm(`确定要执行回滚事务吗？系统将解包恢复快照 [${hist.snapshotPath}] 并重构所有依赖引用。`)) {
      onAddLog(`> [${new Date().toLocaleTimeString()}] 【回滚】正在提取系统快照 ${hist.snapshotPath} 并挂载原物理状态...`);
      setTimeout(() => {
        onAddLog(`> [${new Date().toLocaleTimeString()}] 【回滚】成功！已将本地模块 [${hist.moduleName}] 强力回滚至快照时的 ${hist.version} 版本。`);
      }, 1000);
    }
  };

  // Markdown Doc keyword finder helper
  const handleFindKeywordInDoc = () => {
    if (!markdownDocSearch) {
      setMarkdownDocSearchStatus('未查找');
      return;
    }
    setMarkdownDocSearchStatus(`已找到 3 处关于 "${markdownDocSearch}" 的描述，高亮突出中...`);
  };

  // Export policy files simulation
  const handleExportSourcePolicy = () => {
    const configData = JSON.stringify(marketSources, null, 2);
    setPolicyExportPreviewText(configData);
    onAddLog(`> [${new Date().toLocaleTimeString()}] 【市场源】成功导出了当前 3 个自定义及缓存组件市场策略文件 (SourcePolicy.json) 文本。`);
  };

  // Reset Policy Filters
  const handleResetFilters = () => {
    setPolicyHistorySearch('');
    setPolicyHistoryActionFilter('全部操作');
    setPolicyHistoryTimeFilter('全部时间');
    setPolicyHistoryModeFilter('全部模式');
    onAddLog(`> [${new Date().toLocaleTimeString()}] 【源历史】重置了全部策略和历史导入筛选项。`);
  };

  // ---------------- RENDER METHOD ----------------

  return (
    <div id="module-page-inspector-root" className={`flex flex-col h-full overflow-hidden text-xs ${
      isDarkMode ? 'bg-[#151518]' : 'bg-white text-slate-850'
    }`}>
      
      {/* ScrollViewer Virtual scrolling content body */}
      <div className="flex-1 overflow-y-auto scrollbar-thin select-text p-3 space-y-4">
        
        {/* SECTION 1: 本地模块 */}
        <div className={`flex flex-col gap-2 border rounded p-2.5 ${
          isDarkMode ? 'border-slate-800/80 bg-slate-900/10' : 'border-slate-200 bg-slate-50/50'
        }`}>
          <div className={`flex items-center justify-between border-b pb-1.5 ${
            isDarkMode ? 'border-slate-800' : 'border-slate-200'
          }`}>
            <span className={`font-bold flex items-center gap-1.5 ${
              isDarkMode ? 'text-slate-200' : 'text-slate-800'
            }`}>
              <FolderOpen className="w-3.5 h-3.5 text-blue-500" />
              <span>本地模块 (Local Modules)</span>
            </span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
              isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-200/60 text-slate-700'
            }`}>
              {localModules.length} 个本地缓存
            </span>
          </div>
          <p className={`text-[10.5px] leading-normal ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
            从 modules 目录读取 module.json，后续会接入模块启用、模板注册和 C++ 依赖生成。
          </p>

          {/* WrapPanel operations bar */}
          <div className="flex flex-wrap gap-1.5 mt-1">
            <button
              onClick={() => {
                onAddLog(`> [${new Date().toLocaleTimeString()}] 【模块】正在调取系统资源文件夹，选择要安装的 C++ 模块解压目录...`);
              }}
              className={`px-2 py-1 rounded cursor-pointer text-[10.5px] transition-all border ${
                isDarkMode 
                  ? 'bg-[#22222a] hover:bg-[#2e2e3a] text-slate-300 hover:text-white border-slate-700/60' 
                  : 'bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-950 border-slate-250 shadow-sm'
              }`}
            >
              安装模块目录
            </button>
            <button
              onClick={() => {
                onAddLog(`> [${new Date().toLocaleTimeString()}] 【模块】正在调取资源浏览器选择包文件 (*.lbp) 进行导入写入...`);
              }}
              className={`px-2 py-1 rounded cursor-pointer text-[10.5px] transition-all border ${
                isDarkMode 
                  ? 'bg-[#22222a] hover:bg-[#2e2e3a] text-slate-300 hover:text-white border-slate-700/60' 
                  : 'bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-950 border-slate-250 shadow-sm'
              }`}
            >
              导入模块包
            </button>
            <button
              onClick={() => {
                onAddLog(`> [${new Date().toLocaleTimeString()}] 【模块】正在打包当前的中文编程本地 modules/std_utf8_support 并压缩为模块包...`);
              }}
              className={`px-2 py-1 rounded cursor-pointer text-[10.5px] transition-all border ${
                isDarkMode 
                  ? 'bg-[#22222a] hover:bg-[#2e2e3a] text-slate-300 hover:text-white border-slate-700/60' 
                  : 'bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-950 border-slate-250 shadow-sm'
              }`}
            >
              打包模块目录
            </button>
            <button
              onClick={handleLocalRefresh}
              className={`px-2 py-1 rounded cursor-pointer text-[10.5px] transition-all flex items-center gap-1 border ${
                isDarkMode 
                  ? 'bg-[#22222a] hover:bg-[#2e2e3a] text-slate-300 hover:text-white border-slate-700/60' 
                  : 'bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-950 border-slate-250 shadow-sm'
              }`}
            >
              <RefreshCw className="w-3 h-3 text-cyan-550" />
              <span>刷新模块</span>
            </button>
            <button
              onClick={() => {
                onAddLog(`> [${new Date().toLocaleTimeString()}] 【模块】成功调取资源管理器定位至物理磁盘 C:\\Users\\Administrator\\LingBuilder\\modules 目录。`);
              }}
              className={`px-2 py-1 rounded cursor-pointer text-[10.5px] transition-all border ${
                isDarkMode 
                  ? 'bg-[#22222a] hover:bg-[#2e2e3a] text-slate-300 hover:text-white border-slate-700/60' 
                  : 'bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-950 border-slate-250 shadow-sm'
              }`}
            >
              打开模块目录
            </button>
          </div>

          {/* ModuleStatusText TextBlock */}
          <div id="ModuleStatusText" className={`text-[10px] font-mono italic mt-1 p-1.5 rounded border flex items-center justify-between ${
            isDarkMode ? 'text-slate-400 bg-slate-900/40 border-slate-800/40' : 'text-slate-600 bg-slate-100/50 border-slate-200'
          }`}>
            <span>扫描摘要：{localModules.length > 0 ? '本地已正确载入并索引所需的模块' : '尚未扫描模块。'}</span>
            <span className="text-emerald-500 font-bold">● CL.EXE HOOK ACTIVE</span>
          </div>

          {/* ModuleListPanel StackPanel list */}
          <div id="ModuleListPanel" className="space-y-2 mt-2">
            {localModules.length === 0 ? (
              <div className={`italic text-center py-4 border border-dashed rounded ${
                isDarkMode ? 'text-slate-600 border-slate-800' : 'text-slate-400 border-slate-300'
              }`}>
                未找到本地模块，请点击刷新或者从市场安装。
              </div>
            ) : (
              localModules.map(m => (
                <div key={m.id} className={`p-2 rounded border transition-all ${
                  m.isEnabled 
                    ? isDarkMode ? 'bg-[#1b1b20]/60 border-slate-800/80 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-slate-350 shadow-sm'
                    : isDarkMode ? 'bg-slate-950/20 border-slate-900 opacity-65' : 'bg-slate-100/50 border-slate-200 opacity-65'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`font-bold text-xs ${
                      m.isEnabled 
                        ? isDarkMode ? 'text-amber-400' : 'text-amber-650 font-bold' 
                        : 'text-slate-500 line-through'
                    }`}>{m.name}</span>
                    <span className={`text-[9px] px-1 rounded scale-90 font-mono ${
                      isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600 border border-slate-200/80'
                    }`}>{m.type}</span>
                  </div>

                  <div className={`text-[10.5px] mt-1 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-650'}`}>
                    {m.description}
                  </div>

                  {/* Diagnostic / Error Block */}
                  {m.error && (
                    <div className="mt-1.5 px-2 py-1 bg-rose-950/20 border border-rose-900/30 text-rose-300 rounded font-mono text-[10px] flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>{m.error}</span>
                    </div>
                  )}
                  {m.diagnostic && m.isEnabled && (
                    <div className="mt-1.5 px-2 py-0.5 bg-emerald-950/10 border border-emerald-900/20 text-emerald-300 rounded font-mono text-[9.5px]">
                      诊断: {m.diagnostic}
                    </div>
                  )}

                  {/* Attributes metadata */}
                  <div className={`mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[9.5px] font-mono border-t pt-1.5 ${
                    isDarkMode ? 'text-slate-500 border-slate-800/40' : 'text-slate-550 border-slate-200'
                  }`}>
                    <div>入口: <span className={isDarkMode ? 'text-slate-400' : 'text-slate-700'}>{m.entry}</span></div>
                    <div>兼容: <span className={isDarkMode ? 'text-slate-400' : 'text-slate-700'}>{m.compatibility}</span></div>
                    <div>授权: <span className={m.authorized ? 'text-emerald-500' : 'text-rose-500'}>{m.authorized ? '已通过' : '未授权'}</span></div>
                    <div>C++库: <span className={isDarkMode ? 'text-slate-400' : 'text-slate-700'}>{m.cppDependencies.join(', ') || '无'}</span></div>
                    <div className="col-span-2 truncate">依赖关系: <span className={isDarkMode ? 'text-slate-400' : 'text-slate-700'}>{m.dependencies.join(', ') || '无'}</span></div>
                    <div className="col-span-2 truncate">能力生命: <span className={isDarkMode ? 'text-slate-400' : 'text-slate-700'}>{m.capabilities.join(', ') || '无'}</span></div>
                  </div>

                  {/* Action buttons inside Card */}
                  <div className={`flex flex-wrap gap-1.5 mt-2.5 border-t pt-2 ${
                    isDarkMode ? 'border-slate-800/40' : 'border-slate-200'
                  }`}>
                    <button
                      onClick={() => handleShowCapabilityDetails(m)}
                      className={`px-1.5 py-0.5 rounded text-[10px] cursor-pointer border ${
                        isDarkMode 
                          ? 'bg-slate-800 border-transparent hover:bg-slate-700 text-slate-300 hover:text-white' 
                          : 'bg-white border-slate-250 text-slate-650 hover:bg-slate-50 hover:text-slate-900 shadow-xs'
                      }`}
                    >
                      能力详情
                    </button>
                    <button
                      onClick={() => handleToggleModule(m.id)}
                      className={`px-1.5 py-0.5 rounded text-[10px] cursor-pointer border ${
                        m.isEnabled 
                          ? isDarkMode 
                            ? 'bg-slate-800 border-transparent hover:bg-slate-700 text-slate-300' 
                            : 'bg-white border-slate-250 text-slate-650 hover:bg-slate-50 hover:text-slate-900 shadow-xs'
                          : isDarkMode
                            ? 'bg-[#1a3a1a] border-transparent hover:bg-emerald-800 text-emerald-300'
                            : 'bg-emerald-50 border-emerald-250 text-emerald-700 hover:bg-emerald-100 shadow-xs'
                      }`}
                    >
                      {m.isEnabled ? '禁用模块' : '启用模块'}
                    </button>
                    <button
                      onClick={() => handleUninstallModule(m.id, m.name)}
                      className={`px-1.5 py-0.5 rounded text-[10px] cursor-pointer border ${
                        isDarkMode
                          ? 'bg-rose-950/20 hover:bg-rose-900/20 border-rose-950/30 text-rose-400 hover:text-rose-300'
                          : 'bg-rose-50/50 hover:bg-rose-100/50 border-rose-200 text-rose-650 hover:text-rose-800'
                      }`}
                    >
                      卸载模块
                    </button>
                    {m.error && (
                      <button
                        onClick={() => handleInstallMissingDependencies(m)}
                        className="px-1.5 py-0.5 bg-[#1a2d3d] hover:bg-[#2b3d52] border border-blue-500/20 text-[#4fc3f7] rounded text-[10px] cursor-pointer animate-pulse"
                      >
                        安装缺失依赖
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* SECTION 2: 模块组件运行时接入状态 */}
        <div className={`flex flex-col gap-2 border rounded p-2.5 ${
          isDarkMode ? 'border-slate-800/80 bg-slate-900/10' : 'border-slate-200 bg-slate-50/50'
        }`}>
          <div className={`flex items-center justify-between border-b pb-1.5 ${
            isDarkMode ? 'border-slate-800' : 'border-slate-200'
          }`}>
            <span className={`font-bold flex items-center gap-1.5 ${
              isDarkMode ? 'text-slate-200' : 'text-slate-800'
            }`}>
              <Layers className="w-3.5 h-3.5 text-amber-500" />
              <span>模块组件运行时接入状态</span>
            </span>
          </div>
          <p className={`text-[10.5px] leading-normal ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
            显示当前窗口里来自模块能力的 UI 组件占位，以及它们是否已经接入真实运行时控件。
          </p>

          <div id="ModuleComponentRuntimeStatusText" className={`text-[10px] p-1.5 rounded border ${
            isDarkMode ? 'text-slate-500 bg-slate-900/30 border-slate-800/30' : 'text-slate-600 bg-slate-100/40 border-slate-200'
          }`}>
            提示：当您从工具栏添加高级模块控件到设计器画布后，此视图会自动关联其 C++ 中文类定义、头文件包及命名空间接入状态。
          </div>

          <div id="ModuleComponentRuntimeStatusPanel" className="space-y-2 mt-1">
            {componentStatuses.map(c => (
              <div key={c.id} className={`p-2 rounded border flex flex-col gap-1 ${
                isDarkMode ? 'border-slate-800 bg-[#121215]' : 'border-slate-200 bg-white shadow-sm'
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>{c.name}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border uppercase font-mono ${
                    c.status === 'active'
                      ? 'bg-[#1a3a1a] text-emerald-400 border-emerald-950'
                      : 'bg-rose-950/30 text-rose-400 border-rose-950'
                  }`}>
                    {c.status === 'active' ? '● 运行时已链接' : '● 接口断开 (编译缺失)'}
                  </span>
                </div>
                
                <div className={`text-[10px] grid grid-cols-2 gap-1 font-mono pt-1 ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  <div>原始类型: <span className={isDarkMode ? 'text-slate-300' : 'text-slate-800'}>{c.type}</span></div>
                  <div>归属源: <span className={`truncate block max-w-[100px] ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>{c.source}</span></div>
                  <div className="col-span-2">调用命名空间: <span className={isDarkMode ? 'text-slate-300' : 'text-slate-850'}>{c.namespace}</span></div>
                  <div className="col-span-2 truncate">头文件引用: <code className="text-[#4fc3f7] font-bold">{`<${c.headerFile}>`}</code></div>
                  <div className={`col-span-2 p-1 rounded text-[9px] max-h-12 overflow-y-auto leading-tight border ${
                    isDarkMode 
                      ? 'bg-[#1b1b22] text-slate-500 border-transparent' 
                      : 'bg-slate-50 text-slate-550 border-slate-200'
                  }`}>
                    C++ 契约签名: <span className={isDarkMode ? 'text-slate-400' : 'text-slate-700'}>{c.signature}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 3: 模块操作历史 */}
        <div className={`flex flex-col gap-2 border rounded p-2.5 ${
          isDarkMode ? 'border-slate-800/80 bg-slate-900/10' : 'border-slate-200 bg-slate-50/50'
        }`}>
          <div className={`flex items-center justify-between border-b pb-1.5 ${
            isDarkMode ? 'border-slate-800' : 'border-slate-200'
          }`}>
            <span className={`font-bold flex items-center gap-1.5 ${
              isDarkMode ? 'text-slate-200' : 'text-slate-800'
            }`}>
              <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
              <span>模块操作历史 (Rollback Logs)</span>
            </span>
          </div>
          <p className={`text-[10.5px] leading-normal ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
            记录模块安装、更新、卸载和回滚操作；更新或卸载前会保留可回滚快照。
          </p>

          <div id="ModuleHistoryPanel" className="space-y-1.5 mt-1">
            {operationHistories.length === 0 ? (
              <div className="text-slate-600 italic text-center py-2 text-[10px]">暂无模块操作历史。</div>
            ) : (
              operationHistories.map(h => (
                <div key={h.id} className={`p-2 rounded border font-mono text-[10.5px] flex flex-col gap-1 ${
                  isDarkMode ? 'border-[#2d2d34] bg-[#1c1c22]/50' : 'border-slate-200 bg-white shadow-xs'
                }`}>
                  <div className="flex justify-between text-slate-450">
                    <span>操作: <strong className="text-amber-500 font-bold">[{h.action}]</strong> <span className={isDarkMode ? 'text-slate-200' : 'text-slate-800'}>{h.moduleName} {h.version}</span></span>
                    <span className="text-slate-500 text-[9.5px]">{h.time}</span>
                  </div>
                  {h.snapshotPath && (
                    <div className={`flex items-center justify-between p-1 rounded mt-1 border ${
                      isDarkMode ? 'bg-slate-900/40 border-slate-800/50' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <span className="text-slate-500 text-[9px] truncate max-w-[150px]">快照路径: {h.snapshotPath}</span>
                      <button
                        onClick={() => handleRollbackVersion(h)}
                        className={`px-1.5 py-0.5 rounded text-[9.5px] shrink-0 cursor-pointer border ${
                          isDarkMode 
                            ? 'bg-[#1e222b] hover:bg-[#2b303d] text-indigo-400 hover:text-white border-indigo-500/20' 
                            : 'bg-white hover:bg-slate-100 text-indigo-650 hover:text-indigo-800 border-slate-250 shadow-xs'
                        }`}
                      >
                        回滚到此版本
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>


        {/* SECTION 4: 模块市场 */}
        <div className={`flex flex-col gap-2 border rounded p-2.5 ${
          isDarkMode ? 'border-slate-800/80 bg-slate-900/10' : 'border-slate-200 bg-slate-50/50'
        }`}>
          <div className={`flex items-center justify-between border-b pb-1.5 ${
            isDarkMode ? 'border-slate-800' : 'border-slate-200'
          }`}>
            <span className={`font-bold flex items-center gap-1.5 ${
              isDarkMode ? 'text-slate-200' : 'text-slate-800'
            }`}>
              <Bot className="w-3.5 h-3.5 text-emerald-500" />
              <span>模块市场 (Module Market)</span>
            </span>
          </div>
          <p className={`text-[10.5px] leading-normal ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
            支持本地市场、官方市场和企业市场源；无网络时仍可读取 modules/module-market.json。
          </p>

          {/* WrapPanel market toolbar */}
          <div className="flex flex-wrap gap-1.5 mt-1">
            <button
              onClick={handleRefreshAllMarketSources}
              className={`px-2 py-1 rounded cursor-pointer text-[10.5px] transition-all flex items-center gap-1 border ${
                isDarkMode 
                  ? 'bg-[#22222a] hover:bg-[#2e2e3a] text-slate-300 hover:text-white border-slate-700/60' 
                  : 'bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-950 border-slate-250 shadow-sm'
              }`}
            >
              <RefreshCw className="w-3 h-3 text-emerald-505" />
              <span>刷新市场</span>
            </button>
            <button
              onClick={() => {
                const name = prompt('请输入本地目录源路径/别名:');
                if (name) {
                  setMarketSources(prev => [...prev, { id: `src_local_${Date.now()}`, name, type: 'local', isEnabled: true, location: 'C:\\custom_modules', priority: prev.length + 1, health: 'ok', status: 'ready' }]);
                  onAddLog(`> [${new Date().toLocaleTimeString()}] 【市场源】成功添加本地目录源: ${name}`);
                }
              }}
              className={`px-2 py-1 rounded cursor-pointer text-[10.5px] transition-all border ${
                isDarkMode 
                  ? 'bg-[#22222a] hover:bg-[#2e2e3a] text-slate-300 hover:text-white border-slate-700/60' 
                  : 'bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-950 border-slate-250 shadow-sm'
              }`}
            >
              添加本地目录源
            </button>
            <button
              onClick={() => {
                const name = prompt('请输入在线源 HTTPS API 终结点:');
                if (name) {
                  setMarketSources(prev => [...prev, { id: `src_online_${Date.now()}`, name, type: 'official', isEnabled: true, location: 'https://cdn.lingbuilder.cn/modules', priority: prev.length + 1, health: 'ok', status: 'ready' }]);
                  onAddLog(`> [${new Date().toLocaleTimeString()}] 【市场源】成功添加在线组件源: ${name}`);
                }
              }}
              className={`px-2 py-1 rounded cursor-pointer text-[10.5px] transition-all border ${
                isDarkMode 
                  ? 'bg-[#22222a] hover:bg-[#2e2e3a] text-slate-300 hover:text-white border-slate-700/60' 
                  : 'bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-950 border-slate-250 shadow-sm'
              }`}
            >
              添加在线源
            </button>
            <button
              onClick={handleExportSourcePolicy}
              className={`px-2 py-1 rounded cursor-pointer text-[10.5px] transition-all border ${
                isDarkMode 
                  ? 'bg-[#22222a] hover:bg-[#2e2e3a] text-slate-300 hover:text-white border-slate-700/60' 
                  : 'bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-950 border-slate-250 shadow-sm'
              }`}
            >
              导出源策略
            </button>
            <button
              onClick={() => {
                onAddLog(`> [${new Date().toLocaleTimeString()}] 【市场源】开始导入策略配置文件 (SourcePolicy.json) 并应用覆盖...`);
                setTimeout(() => onAddLog(`> [${new Date().toLocaleTimeString()}] 【市场源】策略导入及合并解析成功！`), 600);
              }}
              className={`px-2 py-1 rounded cursor-pointer text-[10.5px] transition-all border ${
                isDarkMode 
                  ? 'bg-[#22222a] hover:bg-[#2e2e3a] text-slate-300 hover:text-white border-slate-700/60' 
                  : 'bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-950 border-slate-250 shadow-sm'
              }`}
            >
              导入源策略
            </button>
            <button
              id="RestoreModuleMarketSourcePolicyButton"
              onClick={() => {
                onAddLog(`> [${new Date().toLocaleTimeString()}] 【市场源】已成功恢复上次的备份策略快照，所有组件网关地址已恢复出厂设置。`);
              }}
              className={`px-2 py-1 rounded cursor-pointer text-[10.5px] transition-all border ${
                isDarkMode 
                  ? 'bg-[#22222a] hover:bg-[#2e2e3a] text-slate-300 hover:text-white border-slate-700/60' 
                  : 'bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-950 border-slate-250 shadow-sm'
              }`}
            >
              恢复上次源策略
            </button>
            <button
              id="CancelModuleMarketSourceRefreshButton"
              onClick={() => {
                setIsRefreshingSources(false);
                setRefreshProgressText('刷新探测已被用户手动取消。');
                onAddLog(`> [${new Date().toLocaleTimeString()}] 【市场源】组件仓同步检测进程已中断。`);
              }}
              className={`px-2 py-1 rounded cursor-pointer text-[10.5px] transition-all border ${
                isDarkMode 
                  ? 'bg-[#22222a] hover:bg-[#2e2e3a] text-rose-450 hover:text-rose-300 border-rose-950/50' 
                  : 'bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-900 border-rose-200 shadow-sm'
              }`}
            >
              取消刷新
            </button>
            <button
              id="CancelModuleMarketDownloadButton"
              onClick={() => {
                onAddLog(`> [${new Date().toLocaleTimeString()}] 【市场源】活动下载进程已中断，清空临时解压包缓冲。`);
              }}
              className={`px-2 py-1 rounded cursor-pointer text-[10.5px] transition-all border ${
                isDarkMode 
                  ? 'bg-[#22222a] hover:bg-[#2e2e3a] text-rose-450 hover:text-rose-300 border-rose-950/50' 
                  : 'bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-900 border-rose-200 shadow-sm'
              }`}
            >
              取消下载
            </button>
          </div>

          {/* ModuleMarketSourcePanel StackPanel (Market sources list) */}
          <div id="ModuleMarketSourcePanel" className={`space-y-2 mt-2 p-2 rounded border ${
            isDarkMode ? 'bg-[#121215] border-slate-800' : 'bg-slate-100/50 border-slate-200'
          }`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider block mb-1 ${
              isDarkMode ? 'text-slate-500' : 'text-slate-600'
            }`}>已配组件市场源管理</span>
            
            {marketSources.map((src, idx) => (
              <div key={src.id} className={`p-2 rounded border flex flex-col gap-1 font-mono text-[10.5px] ${
                isDarkMode ? 'border-slate-800/80 bg-slate-900/30' : 'border-slate-200 bg-white shadow-xs'
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`font-bold ${
                    src.isEnabled 
                      ? isDarkMode ? 'text-slate-200' : 'text-slate-800' 
                      : 'text-slate-400 line-through'
                  }`}>{src.name}</span>
                  <span className={`text-[8px] px-1 rounded font-sans ${
                    src.health === 'ok' 
                      ? isDarkMode ? 'bg-emerald-950/40 text-emerald-400' : 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                      : 'bg-rose-950/30 text-rose-400'
                  }`}>
                    {src.health === 'ok' ? '● 连通正常' : '● 离线'}
                  </span>
                </div>
                <div className={`text-[9.5px] truncate max-w-[210px] ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>地址: {src.location}</div>
                <div className={`text-[9.5px] ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>优先级: #{src.priority} ({src.type})</div>

                {/* WrapPanel operations on sources */}
                <div className={`flex flex-wrap gap-1 mt-1.5 border-t pt-1.5 ${
                  isDarkMode ? 'border-slate-800/40' : 'border-slate-200'
                }`}>
                  <button
                    onClick={() => handleMoveSource(idx, 'up')}
                    disabled={idx === 0}
                    className={`p-0.5 rounded disabled:opacity-30 cursor-pointer border ${
                      isDarkMode 
                        ? 'bg-slate-800 border-transparent hover:bg-slate-700 text-slate-400' 
                        : 'bg-white border-slate-250 hover:bg-slate-100 text-slate-600'
                    }`}
                    title="上移"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleMoveSource(idx, 'down')}
                    disabled={idx === marketSources.length - 1}
                    className={`p-0.5 rounded disabled:opacity-30 cursor-pointer border ${
                      isDarkMode 
                        ? 'bg-slate-800 border-transparent hover:bg-slate-700 text-slate-400' 
                        : 'bg-white border-slate-250 hover:bg-slate-100 text-slate-600'
                    }`}
                    title="下移"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleRefreshSingleSource(src.id, src.name)}
                    className="px-1 py-0.2 bg-[#212c3d] text-sky-400 rounded text-[9px] hover:bg-sky-900 hover:text-white cursor-pointer"
                  >
                    {src.status === 'refreshing' ? '刷新中...' : '刷新此源'}
                  </button>
                  <button
                    onClick={() => handleToggleSource(src.id, src.name)}
                    className={`px-1 py-0.2 rounded text-[9px] cursor-pointer border ${
                      isDarkMode 
                        ? 'bg-slate-800 border-transparent hover:bg-slate-700 text-slate-300' 
                        : 'bg-white border-slate-250 hover:bg-slate-100 text-slate-600'
                    }`}
                  >
                    {src.isEnabled ? '禁用' : '启用'}
                  </button>
                  {src.type !== 'official' && (
                    <button
                      onClick={() => handleDeleteSource(src.id, src.name)}
                      className="px-1 py-0.2 bg-rose-950/40 text-rose-400 rounded text-[9px] hover:bg-rose-900 hover:text-white cursor-pointer"
                    >
                      删除
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Border (Market source progress & auto refresh strategy block) */}
          <div className={`border rounded p-2.5 space-y-3 ${
            isDarkMode ? 'border-slate-800/60 bg-slate-950/40' : 'border-slate-200 bg-slate-100/50'
          }`}>
            <div>
              <span className={`text-[10px] font-bold uppercase tracking-wider block ${
                isDarkMode ? 'text-slate-400' : 'text-slate-500'
              }`}>市场源刷新进度</span>
              {/* ModuleMarketSourceRefreshProgressText TextBlock */}
              <div id="ModuleMarketSourceRefreshProgressText" className={`text-[10.5px] font-mono mt-1 flex items-center gap-1.5 ${
                isDarkMode ? 'text-cyan-400' : 'text-cyan-650'
              }`}>
                {isRefreshingSources && <RefreshCw className="w-3 h-3 animate-spin text-cyan-500" />}
                <span>{refreshProgressText}</span>
              </div>
            </div>

            {/* Auto refresh checklist settings */}
            <div className={`space-y-1.5 border-t pt-2 text-[10.5px] ${
              isDarkMode ? 'border-slate-800/40' : 'border-slate-200'
            }`}>
              <span className={`text-[10px] font-bold uppercase tracking-wider block mb-1 ${
                isDarkMode ? 'text-slate-400' : 'text-slate-500'
              }`}>自动刷新策略</span>
              <div className={`flex flex-col gap-1 p-2 rounded border ${
                isDarkMode ? 'bg-[#121215]/80 border-slate-800/30' : 'bg-white border-slate-200 shadow-xs'
              }`}>
                {/* ModuleMarketAutoRefreshOnStartupBox CheckBox */}
                <label className={`flex items-center gap-1.5 cursor-pointer ${
                  isDarkMode ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  <input
                    type="checkbox"
                    id="ModuleMarketAutoRefreshOnStartupBox"
                    checked={autoRefreshOnStartup}
                    onChange={e => setAutoRefreshOnStartup(e.target.checked)}
                    className="accent-amber-500 w-3.5 h-3.5"
                  />
                  <span>启动后刷新</span>
                </label>
                {/* ModuleMarketAutoRefreshIntervalBox CheckBox */}
                <label className={`flex items-center gap-1.5 cursor-pointer ${
                  isDarkMode ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  <input
                    type="checkbox"
                    id="ModuleMarketAutoRefreshIntervalBox"
                    checked={autoRefreshInterval}
                    onChange={e => setAutoRefreshInterval(e.target.checked)}
                    className="accent-amber-500 w-3.5 h-3.5"
                  />
                  <span>定时刷新</span>
                </label>
                {/* ModuleMarketAutoRefreshFailedOnlyBox CheckBox */}
                <label className={`flex items-center gap-1.5 cursor-pointer ${
                  isDarkMode ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  <input
                    type="checkbox"
                    id="ModuleMarketAutoRefreshFailedOnlyBox"
                    checked={autoRefreshFailedOnly}
                    onChange={e => setAutoRefreshFailedOnly(e.target.checked)}
                    className="accent-amber-500 w-3.5 h-3.5"
                  />
                  <span>只刷新失败源</span>
                </label>

                {/* ModuleMarketAutoRefreshIntervalMinutesBox TextBox */}
                <div className="flex items-center gap-1 mt-1 font-mono text-[9.5px]">
                  <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>间隔分钟：</span>
                  <input
                    type="text"
                    id="ModuleMarketAutoRefreshIntervalMinutesBox"
                    value={autoRefreshIntervalMinutes}
                    onChange={e => setAutoRefreshIntervalMinutes(e.target.value)}
                    className={`w-12 rounded px-1 text-center border ${
                      isDarkMode ? 'bg-[#22222a] border-slate-700/50 text-slate-200' : 'bg-white border-slate-250 text-slate-850'
                    }`}
                  />
                  <button
                    onClick={handleApplyAutoRefreshSettings}
                    className={`ml-auto px-1.5 py-0.5 rounded font-bold cursor-pointer text-[9px] border ${
                      isDarkMode 
                        ? 'bg-[#254f30] hover:bg-[#1a3a22] text-emerald-300 border-emerald-500/10' 
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-250'
                    }`}
                  >
                    应用策略
                  </button>
                </div>
              </div>

              {/* ModuleMarketAutoRefreshStrategyText TextBlock */}
              <div id="ModuleMarketAutoRefreshStrategyText" className="text-[9.5px] text-amber-500 font-mono italic">
                {autoRefreshStrategyText}
              </div>
            </div>

            {/* Market source refresh logs inside auto refresh container */}
            <div className={`space-y-2 border-t pt-2 ${isDarkMode ? 'border-slate-800/40' : 'border-slate-200'}`}>
              <span className={`text-[10px] font-bold uppercase tracking-wider block ${
                isDarkMode ? 'text-slate-400' : 'text-slate-500'
              }`}>源刷新历史报告</span>
              
              <div className="flex items-center gap-1.5">
                {/* ModuleMarketSourceRefreshHistorySearchBox TextBox */}
                <input
                  type="text"
                  id="ModuleMarketSourceRefreshHistorySearchBox"
                  value={sourceRefreshHistorySearch}
                  onChange={e => setSourceRefreshHistorySearch(e.target.value)}
                  placeholder="搜索历史报告关键字..."
                  className={`flex-1 rounded px-2 py-0.5 font-sans text-[10px] focus:outline-none focus:border-amber-500 border ${
                    isDarkMode ? 'bg-[#121215] border-slate-800 text-slate-200' : 'bg-white border-slate-250 text-slate-850'
                  }`}
                />
                {/* ModuleMarketSourceRefreshHistoryStateFilterBox ComboBox */}
                <select
                  id="ModuleMarketSourceRefreshHistoryStateFilterBox"
                  value={sourceRefreshHistoryStateFilter}
                  onChange={e => setSourceRefreshHistoryStateFilter(e.target.value)}
                  className={`rounded px-1.5 py-0.5 text-[10px] focus:outline-none focus:border-amber-500 border ${
                    isDarkMode ? 'bg-[#121215] border-slate-800 text-slate-300' : 'bg-white border-slate-250 text-slate-750'
                  }`}
                >
                  <option value="全部刷新">全部刷新</option>
                  <option value="成功">成功</option>
                  <option value="失败">失败</option>
                  <option value="已取消">已取消</option>
                </select>
              </div>

              {/* ModuleMarketSourceRefreshHistoryPanel StackPanel */}
              <div id="ModuleMarketSourceRefreshHistoryPanel" className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                {refreshLogs
                  .filter(log => {
                    const matchText = log.sourceName.toLowerCase().includes(sourceRefreshHistorySearch.toLowerCase()) || log.details.toLowerCase().includes(sourceRefreshHistorySearch.toLowerCase());
                    const matchFilter = sourceRefreshHistoryStateFilter === '全部刷新' || 
                      (sourceRefreshHistoryStateFilter === '成功' && log.status === 'success') || 
                      (sourceRefreshHistoryStateFilter === '失败' && log.status === 'failed') || 
                      (sourceRefreshHistoryStateFilter === '已取消' && log.status === 'cancelled');
                    return matchText && matchFilter;
                  })
                  .map(log => (
                    <div key={log.id} className={`p-1.5 rounded border text-[10px] leading-relaxed flex flex-col font-mono ${
                      isDarkMode ? 'border-slate-800 bg-[#121215]/80 text-slate-400' : 'border-slate-200 bg-white text-slate-600 shadow-xs'
                    }`}>
                      <div className="flex justify-between items-center text-[9.5px]">
                        <span className={`font-bold truncate max-w-[120px] ${isDarkMode ? 'text-slate-300' : 'text-slate-750'}`}>{log.sourceName}</span>
                        <span className={log.status === 'success' ? 'text-emerald-500 font-semibold' : 'text-rose-500 font-semibold'}>
                          {log.status === 'success' ? '成功' : log.status === 'failed' ? '失败' : '取消'}
                        </span>
                      </div>
                      <div>{log.details}</div>
                      <div className={`text-[8.5px] self-end mt-0.5 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>{log.time}</div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Policy import/restore history block */}
            <div className={`space-y-2 border-t pt-2.5 ${isDarkMode ? 'border-slate-800/40' : 'border-slate-200'}`}>
              <span className={`text-[10px] font-bold uppercase tracking-wider block ${
                isDarkMode ? 'text-slate-400' : 'text-slate-500'
              }`}>源策略导入 / 恢复历史</span>
              
              <div className="grid grid-cols-2 gap-1.5">
                {/* ModuleMarketSourcePolicyHistorySearchBox TextBox */}
                <input
                  type="text"
                  id="ModuleMarketSourcePolicyHistorySearchBox"
                  value={policyHistorySearch}
                  onChange={e => setPolicyHistorySearch(e.target.value)}
                  placeholder="搜索源策略历史..."
                  className={`col-span-2 rounded px-2 py-0.5 text-[10px] focus:outline-none focus:border-amber-500 border ${
                    isDarkMode ? 'bg-[#121215] border-slate-800 text-slate-200' : 'bg-white border-slate-250 text-slate-850'
                  }`}
                />
                
                {/* ModuleMarketSourcePolicyHistoryActionFilterBox ComboBox */}
                <select
                  id="ModuleMarketSourcePolicyHistoryActionFilterBox"
                  value={policyHistoryActionFilter}
                  onChange={e => setPolicyHistoryActionFilter(e.target.value)}
                  className={`rounded px-1.5 py-0.5 text-[10px] focus:outline-none focus:border-amber-500 border ${
                    isDarkMode ? 'bg-[#121215] border-slate-800 text-slate-300' : 'bg-white border-slate-250 text-slate-750'
                  }`}
                >
                  <option value="全部操作">全部操作</option>
                  <option value="导入">导入</option>
                  <option value="恢复">恢复</option>
                </select>

                {/* ModuleMarketSourcePolicyHistoryTimeFilterBox ComboBox */}
                <select
                  id="ModuleMarketSourcePolicyHistoryTimeFilterBox"
                  value={policyHistoryTimeFilter}
                  onChange={e => setPolicyHistoryTimeFilter(e.target.value)}
                  className={`rounded px-1.5 py-0.5 text-[10px] focus:outline-none focus:border-amber-500 border ${
                    isDarkMode ? 'bg-[#121215] border-slate-800 text-slate-300' : 'bg-white border-slate-250 text-slate-750'
                  }`}
                >
                  <option value="全部时间">全部时间</option>
                  <option value="今天">今天</option>
                  <option value="最近 7 天">最近 7 天</option>
                  <option value="最近 30 天">最近 30 天</option>
                </select>

                {/* ModuleMarketSourcePolicyHistoryModeFilterBox ComboBox */}
                <select
                  id="ModuleMarketSourcePolicyHistoryModeFilterBox"
                  value={policyHistoryModeFilter}
                  onChange={e => setPolicyHistoryModeFilter(e.target.value)}
                  className={`col-span-2 rounded px-1.5 py-0.5 text-[10px] focus:outline-none focus:border-amber-500 border ${
                    isDarkMode ? 'bg-[#121215] border-slate-800 text-slate-300' : 'bg-white border-slate-250 text-slate-750'
                  }`}
                >
                  <option value="全部模式">全部模式</option>
                  <option value="覆盖导入">覆盖导入</option>
                  <option value="合并导入">合并导入</option>
                  <option value="回滚快照">回滚快照</option>
                </select>

                {/* Reset filters button */}
                <button
                  onClick={handleResetFilters}
                  className={`col-span-2 py-1 text-[10px] rounded cursor-pointer border ${
                    isDarkMode 
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700/40' 
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-250 shadow-sm'
                  }`}
                >
                  重置筛选
                </button>
              </div>

              {/* ModuleMarketSourcePolicyHistoryPanel StackPanel */}
              <div id="ModuleMarketSourcePolicyHistoryPanel" className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {policyHistories
                  .filter(p => {
                    const matchText = p.sourceName.toLowerCase().includes(policyHistorySearch.toLowerCase()) || p.details.toLowerCase().includes(policyHistorySearch.toLowerCase());
                    const matchAction = policyHistoryActionFilter === '全部操作' || p.action === policyHistoryActionFilter;
                    const matchMode = policyHistoryModeFilter === '全部模式' || p.mode === policyHistoryModeFilter;
                    return matchText && matchAction && matchMode;
                  })
                  .map(p => (
                    <div key={p.id} className={`p-2 rounded border text-[10px] flex flex-col gap-1 font-mono ${
                      isDarkMode ? 'border-slate-800 bg-[#141417] text-slate-400' : 'border-slate-200 bg-white text-slate-600 shadow-xs'
                    }`}>
                      <div className="flex justify-between font-bold">
                        <span className={isDarkMode ? 'text-slate-300' : 'text-slate-850'}>[{p.action}] {p.sourceName}</span>
                        <span className="text-amber-500">{p.mode}</span>
                      </div>
                      <div>{p.details}</div>
                      <div className={`flex gap-2 mt-1 justify-end border-t pt-1.5 ${
                        isDarkMode ? 'border-slate-800/40' : 'border-slate-200'
                      }`}>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(JSON.stringify(p, null, 2));
                            onAddLog(`> [${new Date().toLocaleTimeString()}] 【源策略】已复制该条历史的备份字段。`);
                          }}
                          className={`px-1.5 py-0.5 rounded text-[9px] cursor-pointer border ${
                            isDarkMode 
                              ? 'bg-slate-800 border-transparent text-slate-300 hover:text-white' 
                              : 'bg-white border-slate-250 text-slate-600 hover:bg-slate-100 shadow-xs'
                          }`}
                        >
                          复制
                        </button>
                        <button
                          onClick={() => setActivePolicyDetail(p)}
                          className={`px-1.5 py-0.5 rounded text-[9px] cursor-pointer border ${
                            isDarkMode 
                              ? 'bg-indigo-950/40 border-transparent text-indigo-300 hover:text-white' 
                              : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 shadow-xs'
                          }`}
                        >
                          详情
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* ModuleMarketSearchBox TextBox */}
          <div className={`space-y-1.5 border-t pb-2 pt-3 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider block ${
              isDarkMode ? 'text-slate-400' : 'text-slate-500'
            }`}>搜索和筛选市场模块</span>
            <div className="relative flex items-center">
              <input
                type="text"
                id="ModuleMarketSearchBox"
                value={marketSearchQuery}
                onChange={e => setMarketSearchQuery(e.target.value)}
                placeholder="搜索模块名称, 说明, ID, 标签..."
                className={`w-full rounded px-2.5 py-1.5 pl-7 text-[11px] focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 border ${
                  isDarkMode ? 'bg-[#121215] border-slate-800 text-slate-200' : 'bg-white border-slate-250 text-slate-850 shadow-sm'
                }`}
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2" />
              {marketSearchQuery && (
                <X
                  className="w-3.5 h-3.5 text-slate-400 hover:text-white absolute right-2 cursor-pointer"
                  onClick={() => setMarketSearchQuery('')}
                />
              )}
            </div>
          </div>

          {/* Type & State filters for module list */}
          <div className="grid grid-cols-2 gap-1.5">
            {/* ModuleMarketTypeFilterBox ComboBox */}
            <select
              id="ModuleMarketTypeFilterBox"
              value={marketTypeFilter}
              onChange={e => setMarketTypeFilter(e.target.value)}
              className={`rounded px-2 py-1 text-[10.5px] focus:outline-none focus:border-amber-500 border ${
                isDarkMode ? 'bg-[#121215] border-slate-800 text-slate-300' : 'bg-white border-slate-250 text-slate-750'
              }`}
            >
              <option value="全部类型">全部类型</option>
              <option value="项目模板">项目模板</option>
              <option value="UI 组件">UI 组件</option>
              <option value="代码模板">代码模板</option>
              <option value="AI Agent">AI Agent</option>
              <option value="浏览器适配">浏览器适配</option>
              <option value="业务模块">业务模块</option>
              <option value="C++ 依赖">C++ 依赖</option>
            </select>

            {/* ModuleMarketStateFilterBox ComboBox */}
            <select
              id="ModuleMarketStateFilterBox"
              value={marketStateFilter}
              onChange={e => setMarketStateFilter(e.target.value)}
              className={`rounded px-2 py-1 text-[10.5px] focus:outline-none focus:border-amber-500 border ${
                isDarkMode ? 'bg-[#121215] border-slate-800 text-slate-300' : 'bg-white border-slate-250 text-slate-750'
              }`}
            >
              <option value="全部状态">全部状态</option>
              <option value="可安装">可安装</option>
              <option value="已安装">已安装</option>
              <option value="可更新">可更新</option>
              <option value="版本冲突">版本冲突</option>
              <option value="不兼容">不兼容</option>
              <option value="可回滚">可回滚</option>
            </select>
          </div>

          {/* ModuleMarketStatusText TextBlock */}
          <div id="ModuleMarketStatusText" className={`text-[10px] font-mono italic p-1.5 rounded border text-center ${
            isDarkMode ? 'bg-slate-900/30 border-slate-800/20 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
          }`}>
            {marketStatusText}
          </div>

          {/* Dynamic popups/panels within modules page */}

          {/* Policy Detail Preview Border */}
          {activePolicyDetail && (
            <div className="border border-indigo-500/30 rounded bg-[#161622] p-2.5 space-y-2">
              <div className="flex items-center justify-between border-b border-indigo-950 pb-1.5">
                <span className="font-bold text-slate-200">源策略历史详情预览</span>
                <X className="w-3.5 h-3.5 text-slate-400 hover:text-white cursor-pointer" onClick={() => setActivePolicyDetail(null)} />
              </div>
              <div className="text-[10px] text-slate-300 font-mono space-y-1">
                <div><strong>操作:</strong> {activePolicyDetail.action} ({activePolicyDetail.mode})</div>
                <div><strong>时间:</strong> {activePolicyDetail.time}</div>
                <div><strong>目标源:</strong> {activePolicyDetail.sourceName}</div>
                <div><strong>详情:</strong> {activePolicyDetail.details}</div>
                <div className="bg-slate-950/40 p-1.5 rounded text-[9px] mt-1 space-y-1 border border-slate-900">
                  <div className="text-slate-500">变更前: {activePolicyDetail.changesBefore}</div>
                  <div className="text-emerald-400">变更后: {activePolicyDetail.changesAfter}</div>
                </div>
              </div>
            </div>
          )}

          {/* Policy Export Preview Border */}
          {policyExportPreviewText && (
            <div className="border border-slate-700/50 rounded bg-[#1b1b22] p-2.5 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                <span className="font-bold text-slate-300 font-mono">策略配置导出预览</span>
                <X className="w-3.5 h-3.5 text-slate-400 hover:text-white cursor-pointer" onClick={() => setPolicyExportPreviewText(null)} />
              </div>
              <textarea
                readOnly
                value={policyExportPreviewText}
                className="w-full h-24 bg-[#0d0d10] text-[9.5px] text-slate-400 p-1 rounded font-mono border border-slate-800 focus:outline-none"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(policyExportPreviewText);
                  onAddLog(`> [${new Date().toLocaleTimeString()}] 【源策略】导出内容已复制到剪贴板！`);
                  setPolicyExportPreviewText(null);
                }}
                className="w-full py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[10px] rounded cursor-pointer"
              >
                复制当前视图正文
              </button>
            </div>
          )}

          {/* ModuleMarketDetailPanel Border (Collapsed/Visible dynamically) */}
          {selectedMarketModule && (
            <div id="ModuleMarketDetailPanel" className="border border-amber-500/30 rounded bg-[#1b1b22] p-3 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-xs text-amber-400 flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>模块详情: {selectedMarketModule.name}</span>
                </span>
                <X className="w-4 h-4 text-slate-400 hover:text-white cursor-pointer" onClick={() => setSelectedMarketModule(null)} />
              </div>

              <div className="text-[10.5px] text-slate-300 font-mono leading-normal grid grid-cols-2 gap-x-2 gap-y-1">
                <div>类型: <span className="text-slate-400">{selectedMarketModule.type}</span></div>
                <div>最新版本: <span className="text-slate-400">{selectedMarketModule.version}</span></div>
                <div>发布者: <span className="text-slate-400">{selectedMarketModule.publisher}</span></div>
                <div className="col-span-2">SHA256: <code className="text-slate-500 block break-all bg-slate-900/60 p-1 rounded mt-0.5">{selectedMarketModule.sha256}</code></div>
                <div className="col-span-2 text-slate-400 mt-1.5 leading-relaxed bg-[#121215] p-2 rounded border border-slate-800/40">
                  {selectedMarketModule.description}
                </div>
              </div>

              {/* Document and Update link buttons */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                <button
                  onClick={() => onAddLog(`> [${new Date().toLocaleTimeString()}] 【文档】正在打开模块 [${selectedMarketModule.name}] 的官方支持页面...`)}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[9.5px] cursor-pointer flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>文档</span>
                </button>
                <button
                  onClick={() => onAddLog(`> [${new Date().toLocaleTimeString()}] 【更新日志】正在请求 [${selectedMarketModule.id}] 版本的增量更新日志...`)}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[9.5px] cursor-pointer"
                >
                  更新日志
                </button>
              </div>

              {/* Markdown Document preview area with folding */}
              <div className="border border-slate-800 rounded bg-[#101013] p-2.5 space-y-2">
                <span className="text-[10px] text-slate-500 font-bold uppercase block border-b border-slate-800 pb-1">Markdown 帮助文档</span>
                
                {/* Search in documentation */}
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={markdownDocSearch}
                    onChange={e => setMarkdownDocSearch(e.target.value)}
                    placeholder="在文档中搜索关键字..."
                    className="flex-1 bg-[#1c1c22] border border-slate-800 rounded px-2 py-0.5 text-[9.5px] text-slate-300 focus:outline-none"
                  />
                  <button
                    onClick={handleFindKeywordInDoc}
                    className="px-2 py-0.5 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded text-[9px] cursor-pointer"
                  >
                    查找
                  </button>
                </div>
                <div className="text-[8.5px] text-amber-500/80 font-mono">{markdownDocSearchStatus}</div>

                <div className={`text-[10.5px] text-slate-300 leading-normal font-mono transition-all overflow-hidden ${
                  markdownDocFolded ? 'max-h-24' : 'max-h-none'
                }`}>
                  <pre className="whitespace-pre-wrap">{selectedMarketModule.readmeMarkdown}</pre>
                </div>

                <div className="flex justify-between items-center border-t border-slate-800/40 pt-1.5">
                  <button
                    onClick={() => setMarkdownDocFolded(!markdownDocFolded)}
                    className="text-[9.5px] text-sky-400 hover:underline cursor-pointer font-bold"
                  >
                    {markdownDocFolded ? '展开 Markdown 文档预览 (长文档已折叠)' : '收起文档预览'}
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedMarketModule.readmeMarkdown);
                      setMarkdownDocCopyStatus('已复制到剪贴板！');
                      setTimeout(() => setMarkdownDocCopyStatus('未复制'), 2000);
                    }}
                    className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[9px] cursor-pointer"
                  >
                    {markdownDocCopyStatus === '未复制' ? '复制文档正文' : '已复制！'}
                  </button>
                </div>
              </div>

              {/* AI Context Management Area */}
              <div className="border border-slate-800 rounded bg-[#101013] p-2.5 space-y-2">
                <span className="text-[10px] text-emerald-400 font-bold uppercase block border-b border-slate-800 pb-1">AI 知识上下文</span>
                <p className="text-[9px] text-slate-500">将这些高契约 Markdown 知识挂载至 AI 上下文，可帮助 AI 在汉化和优化时做出极高精度判断。</p>
                
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => {
                      setAiDocSearchStatus('发送就绪！当前 2 个上下文包已成功挂载。');
                      onAddLog(`> [${new Date().toLocaleTimeString()}] 【AI】成功将 [${selectedMarketModule.name}] 文档注入本地 Gemini 3.5 预置知识上下文。`);
                    }}
                    className="px-1.5 py-0.5 bg-[#1a3a1a] text-emerald-300 rounded text-[9px] border border-emerald-950 hover:bg-emerald-800 cursor-pointer"
                  >
                    发送全文到 AI
                  </button>
                  <button
                    onClick={() => {
                      setAiContexts([]);
                      onAddLog(`> [${new Date().toLocaleTimeString()}] 【AI】已清空全部加载的外部模块 AI 训练背景。`);
                    }}
                    className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded text-[9px] hover:bg-slate-700 cursor-pointer"
                  >
                    清空上下文
                  </button>
                </div>
                <div className="text-[9px] text-emerald-400 font-mono font-bold">{aiDocSearchStatus}</div>

                {/* AI contexts lists with custom desensitization */}
                <div className="space-y-1 mt-1 max-h-24 overflow-y-auto">
                  {aiContexts.map(ctx => (
                    <div key={ctx.id} className="p-1.5 rounded border border-slate-800/60 bg-slate-900/40 text-[9.5px] leading-relaxed flex flex-col font-mono text-slate-400">
                      <div className="flex justify-between items-center text-slate-300">
                        <span>[{ctx.type}] {ctx.doc}</span>
                        <span className="text-[8.5px] text-slate-600">{ctx.length} 字符</span>
                      </div>
                      <div>{ctx.summary}</div>
                      <button
                        onClick={() => {
                          setAiContexts(prev => prev.filter(c => c.id !== ctx.id));
                          onAddLog(`> [${new Date().toLocaleTimeString()}] 【AI】删除了特定的单条训练标头契约。`);
                        }}
                        className="self-end text-[8.5px] text-rose-400 hover:underline cursor-pointer"
                      >
                        删除本条
                      </button>
                    </div>
                  ))}
                </div>

                {/* Custom desensitization sub-panel */}
                <div className="bg-[#141418] p-2 rounded border border-slate-800/80 mt-2 space-y-1">
                  <span className="text-[9px] text-slate-400 font-bold font-mono">自定义安全脱敏规则</span>
                  <div className="flex gap-1.5">
                    {['通用加密防护', 'C++ 内外部脱敏'].map(grp => (
                      <button
                        key={grp}
                        onClick={() => setSelectedDesensitizationRuleGroup(grp)}
                        className={`px-1.5 py-0.2 rounded text-[8.5px] cursor-pointer ${
                          selectedDesensitizationRuleGroup === grp ? 'bg-slate-800 text-amber-400 font-bold' : 'text-slate-500'
                        }`}
                      >
                        {grp}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-1 mt-1 text-[8.5px] font-mono text-slate-500">
                    {desensitizationRules
                      .filter(r => r.group === selectedDesensitizationRuleGroup)
                      .map((r, i) => (
                        <div key={i} className="flex justify-between items-center border-b border-slate-800/40 pb-0.5">
                          <span>{r.name} (<code className="text-amber-500/85">{r.regex}</code>)</span>
                          <span className="text-emerald-400">{r.status}</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              {/* Screenshots preview gallery */}
              <div className="border border-slate-800 rounded bg-[#101013] p-2.5 space-y-2">
                <span className="text-[10px] text-slate-500 font-bold uppercase block border-b border-slate-800 pb-1">截图预览 (Screenshots)</span>
                
                <div className="flex flex-wrap gap-2">
                  {selectedMarketModule.screenshots.map((shot, sIdx) => (
                    <div key={sIdx} className="p-1 rounded bg-[#1b1b22] border border-slate-800 flex flex-col gap-1 items-center">
                      <img
                        src={shot}
                        alt="Screenshot"
                        referrerPolicy="no-referrer"
                        className="w-24 h-16 object-cover rounded hover:opacity-80 transition-opacity cursor-pointer"
                        onClick={() => {
                          setActiveZoomedScreenshot({ list: selectedMarketModule.screenshots, index: sIdx });
                          setScreenshotScale(100);
                        }}
                      />
                      <button
                        onClick={() => {
                          setActiveZoomedScreenshot({ list: selectedMarketModule.screenshots, index: sIdx });
                          setScreenshotScale(100);
                        }}
                        className="text-[8.5px] text-sky-400 hover:underline cursor-pointer"
                      >
                        放大预览
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ModuleMarketInstallPlanPanel Border (Collapsed/Visible dynamically) */}
          {activeInstallPlan && (
            <div id="ModuleMarketInstallPlanPanel" className="border border-indigo-500/50 rounded bg-[#161622] p-3 space-y-3">
              <div className="flex items-center justify-between border-b border-indigo-900 pb-1.5">
                <span className="font-bold text-xs text-indigo-400 flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>模块安装计划 (Install Contract Plan)</span>
                </span>
                <X className="w-3.5 h-3.5 text-slate-400 hover:text-white cursor-pointer" onClick={() => setActiveInstallPlan(null)} />
              </div>
              
              <div className="text-[10.5px] text-slate-300 space-y-1.5 leading-normal font-mono">
                <div><strong>目标模块:</strong> {activeInstallPlan.name} (ID: {activeInstallPlan.id})</div>
                <div><strong>版本状态:</strong> v{activeInstallPlan.version} ({activeInstallPlan.versionPolicy})</div>
                <div><strong>安全签名比对:</strong> SHA256 吻合，来自官方受信链发布。</div>
                <div><strong>自动下载规则:</strong> {activeInstallPlan.dependenciesPolicy}</div>
                
                <div className="bg-slate-950/60 p-2 rounded text-[9.5px] text-slate-400 leading-relaxed border border-slate-900">
                  <span className="text-amber-400 font-bold block mb-0.5">⚠️ 原生 C++ 汉化底层变更声明:</span>
                  1. 将会把类成员拦截器附加到 MainWindow.xml。{"\n"}
                  2. 自动在本地 C++ 项目的 /modules/ 目录注入 std_locale 相关的编译单元 (.lib, .h)。{"\n"}
                  3. 安装结束后，设计器画布将自动增加来自此组件的能力模块支持。
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => handleExecuteInstall(activeInstallPlan)}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold cursor-pointer text-[10.5px]"
                >
                  确认安装
                </button>
                <button
                  onClick={() => setActiveInstallPlan(null)}
                  className="px-3 py-1 bg-[#22222a] hover:bg-[#2e2e3a] text-slate-300 rounded cursor-pointer text-[10.5px]"
                >
                  取消
                </button>
              </div>
            </div>
          )}

          {/* ModuleMarketInstallResultPanel Border (Collapsed/Visible dynamically) */}
          {activeInstallResult && (
            <div id="ModuleMarketInstallResultPanel" className="border border-emerald-500/50 rounded bg-[#15251a] p-3 space-y-3">
              <div className="flex items-center justify-between border-b border-emerald-900 pb-1.5">
                <span className="font-bold text-xs text-emerald-400 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>模块安装结果报告</span>
                </span>
                <X className="w-3.5 h-3.5 text-slate-400 hover:text-white cursor-pointer" onClick={() => setActiveInstallResult(null)} />
              </div>

              <div className="text-[10.5px] text-slate-300 font-mono space-y-1.5 leading-normal">
                <div><strong>关联模块:</strong> {activeInstallResult.moduleName}</div>
                <div><strong>事务执行结果:</strong> <span className="text-emerald-400 font-bold">{activeInstallResult.message}</span></div>
                <pre className="bg-slate-950/70 p-2 rounded text-[9px] text-slate-400 whitespace-pre-wrap leading-relaxed border border-slate-900">
                  {activeInstallResult.details}
                </pre>
              </div>

              <div className="flex justify-end gap-1.5">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(activeInstallResult, null, 2));
                    onAddLog(`> [${new Date().toLocaleTimeString()}] 【市场安装】已复制安装结果报告至剪贴板。`);
                  }}
                  className="px-2.5 py-1 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded text-[10px] cursor-pointer"
                >
                  复制报告
                </button>
                <button
                  onClick={() => setActiveInstallResult(null)}
                  className="px-2.5 py-1 bg-emerald-800 text-white hover:bg-emerald-700 rounded text-[10px] font-bold cursor-pointer"
                >
                  确定
                </button>
              </div>
            </div>
          )}

          {/* ModuleMarketListPanel StackPanel (Market modules list) */}
          <div id="ModuleMarketListPanel" className="space-y-2.5 mt-2">
            {marketModules
              .filter(m => {
                const matchText = m.name.toLowerCase().includes(marketSearchQuery.toLowerCase()) || 
                  m.description.toLowerCase().includes(marketSearchQuery.toLowerCase()) || 
                  m.tags.some(t => t.toLowerCase().includes(marketSearchQuery.toLowerCase()));
                const matchType = marketTypeFilter === '全部类型' || m.type === marketTypeFilter;
                const matchState = marketStateFilter === '全部状态' || 
                  (marketStateFilter === '可安装' && !m.localVersion) || 
                  (marketStateFilter === '已安装' && m.localVersion) || 
                  (marketStateFilter === '可更新' && m.localVersion && m.localVersion !== m.version);
                return matchText && matchType && matchState;
              })
              .map(m => (
                <div key={m.id} className="p-2.5 rounded border border-[#2d2d34] bg-slate-900/30 hover:bg-[#1a1a22] transition-colors flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-amber-400">{m.name}</span>
                    <span className="text-[9px] px-1 bg-slate-800 text-slate-400 rounded font-mono scale-90">{m.type}</span>
                  </div>

                  <p className="text-[10.5px] text-slate-400 leading-normal">
                    {m.description}
                  </p>

                  {/* Metadata labels info wrap */}
                  <div className="flex flex-wrap gap-1.5 text-[9px] text-slate-500 font-mono">
                    <span className="px-1 py-0.2 bg-[#1b1b22] border border-slate-800 rounded">市场版本: v{m.version}</span>
                    {m.localVersion && (
                      <span className="px-1 py-0.2 bg-[#1b1b22] border border-slate-800 rounded text-amber-500">
                        本地已装: {m.localVersion} (可更新)
                      </span>
                    )}
                    <span className="px-1 py-0.2 bg-[#1b1b22] border border-slate-800 rounded">评分: ★ {m.rating}</span>
                    <span className="px-1 py-0.2 bg-[#1b1b22] border border-slate-800 rounded">下载: {m.downloads}</span>
                    <span className="px-1 py-0.2 bg-[#1b1b22] border border-slate-800 rounded">更新: {m.updateTime.substring(0, 10)}</span>
                  </div>

                  {/* Action buttons on card footer */}
                  <div className="flex gap-2 border-t border-slate-800/40 pt-2.5 mt-1">
                    <button
                      onClick={() => setSelectedMarketModule(m)}
                      className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-[10px] cursor-pointer"
                    >
                      查看详情
                    </button>
                    <button
                      onClick={() => handleShowInstallPlan(m)}
                      className="px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded text-[10px] cursor-pointer"
                    >
                      {m.localVersion ? '更新模块' : '下载并安装'}
                    </button>
                    {m.localVersion && (
                      <button
                        onClick={() => {
                          onAddLog(`> [${new Date().toLocaleTimeString()}] 【市场回滚】正在对 [${m.name}] 执行降级回滚策略...`);
                          setTimeout(() => onAddLog(`> [${new Date().toLocaleTimeString()}] 【市场回滚】成功回退至本地 ${m.localVersion} 版本状态。`), 800);
                        }}
                        className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-rose-400 hover:text-white rounded text-[10px] cursor-pointer"
                      >
                        回滚模块
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>

          {/* Market install history panel */}
          <div className="space-y-2 border-t border-slate-800/60 pt-3.5 mt-2">
            <span className="font-bold text-slate-300 flex items-center gap-1">
              <FileCode className="w-3.5 h-3.5 text-blue-400" />
              <span>市场安装历史报告</span>
            </span>
            <p className="text-[10px] text-slate-500 leading-normal">
              保留最近的市场安装成功、失败和回滚报告，重启 IDE 后仍可查看。
            </p>

            <div className="flex items-center gap-1.5">
              {/* ModuleMarketInstallHistorySearchBox TextBox */}
              <input
                type="text"
                id="ModuleMarketInstallHistorySearchBox"
                value={installHistorySearch}
                onChange={e => setInstallHistorySearch(e.target.value)}
                placeholder="搜索安装历史中的模块名..."
                className="flex-1 bg-[#121215] border border-slate-800 rounded px-2.5 py-0.5 text-[10px] text-slate-200 focus:outline-none"
              />
              {/* ModuleMarketInstallHistoryStateFilterBox ComboBox */}
              <select
                id="ModuleMarketInstallHistoryStateFilterBox"
                value={installHistoryStateFilter}
                onChange={e => setInstallHistoryStateFilter(e.target.value)}
                className="bg-[#121215] border border-slate-800 rounded px-1.5 py-0.5 text-[10px] text-slate-300"
              >
                <option value="全部历史">全部历史</option>
                <option value="成功">成功</option>
                <option value="失败/回滚">失败/回滚</option>
              </select>
            </div>

            {/* ModuleMarketInstallHistoryPanel StackPanel */}
            <div id="ModuleMarketInstallHistoryPanel" className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
              {installHistories
                .filter(hist => {
                  const matchSearch = hist.moduleName.toLowerCase().includes(installHistorySearch.toLowerCase());
                  const matchState = installHistoryStateFilter === '全部历史' || 
                    (installHistoryStateFilter === '成功' && hist.status === 'success') || 
                    (installHistoryStateFilter === '失败/回滚' && (hist.status === 'failed' || hist.status === 'rollback'));
                  return matchSearch && matchState;
                })
                .map(hist => (
                  <div key={hist.id} className="p-2 rounded border border-slate-800 bg-[#121215]/60 text-[10px] flex flex-col font-mono text-slate-400">
                    <div className="flex justify-between items-center text-[9.5px]">
                      <span className="font-bold text-slate-300">{hist.moduleName}</span>
                      <span className="text-emerald-400">安装成功</span>
                    </div>
                    <div>{hist.summary}</div>
                    <button
                      onClick={() => {
                        alert(`【市场安装历史详细报告】\n\n- 模块名称: ${hist.moduleName}\n- 记录时间: ${hist.time}\n- 详细事务日志:\n${hist.details}`);
                      }}
                      className="self-end mt-1 px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[9px] cursor-pointer"
                    >
                      查看报告
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: Zoomed screenshot modal portal representation */}
      {activeZoomedScreenshot && (
        <div className="fixed inset-0 bg-slate-950/85 z-50 flex flex-col items-center justify-center p-4">
          <div className="bg-[#1a1a22] border border-slate-800 rounded-lg max-w-xl w-full p-3 space-y-3 flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-slate-200">截图放大预览 ({activeZoomedScreenshot.index + 1}/{activeZoomedScreenshot.list.length})</span>
              <X className="w-4 h-4 text-slate-400 hover:text-white cursor-pointer" onClick={() => setActiveZoomedScreenshot(null)} />
            </div>

            {/* ScrollViewer containing zoomed image */}
            <div className="flex-1 overflow-auto max-h-[300px] bg-[#0c0c10] rounded border border-slate-900 flex items-center justify-center p-2 relative">
              <img
                src={activeZoomedScreenshot.list[activeZoomedScreenshot.index]}
                alt="Zoomed Screenshot"
                referrerPolicy="no-referrer"
                className="max-h-full max-w-full transition-transform"
                style={{ transform: `scale(${screenshotScale / 100})` }}
              />
            </div>

            {/* Scale control bar wrap */}
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span>缩放: {screenshotScale}%</span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setScreenshotScale(100)}
                  className="px-2 py-0.5 bg-slate-800 rounded hover:bg-slate-700 cursor-pointer text-[9px]"
                >
                  适应窗口
                </button>
                <button
                  onClick={() => setScreenshotScale(150)}
                  className="px-2 py-0.5 bg-slate-800 rounded hover:bg-slate-700 cursor-pointer text-[9px]"
                >
                  原始大小
                </button>
                <button
                  onClick={() => setScreenshotScale(prev => Math.min(300, prev + 25))}
                  className="p-1 bg-slate-800 rounded hover:bg-slate-700 cursor-pointer"
                  title="放大"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setScreenshotScale(prev => Math.max(50, prev - 25))}
                  className="p-1 bg-slate-800 rounded hover:bg-slate-700 cursor-pointer"
                  title="缩小"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Navigation buttons */}
            <div className="flex justify-between border-t border-slate-800/60 pt-2">
              <button
                disabled={activeZoomedScreenshot.index === 0}
                onClick={() => setActiveZoomedScreenshot(prev => prev ? { ...prev, index: prev.index - 1 } : null)}
                className="px-3 py-1 bg-slate-800 text-slate-300 hover:text-white rounded disabled:opacity-30 cursor-pointer text-[10px]"
              >
                上一张
              </button>
              <button
                disabled={activeZoomedScreenshot.index === activeZoomedScreenshot.list.length - 1}
                onClick={() => setActiveZoomedScreenshot(prev => prev ? { ...prev, index: prev.index + 1 } : null)}
                className="px-3 py-1 bg-slate-800 text-slate-300 hover:text-white rounded disabled:opacity-30 cursor-pointer text-[10px]"
              >
                下一张
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
