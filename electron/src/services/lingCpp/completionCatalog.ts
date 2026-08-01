import { LING_CPP_COMMANDS, LING_CPP_KEYWORDS, LING_CPP_TYPES } from './parser';
import {
  LingCppCompletionCatalogItem,
  LingCppCompletionContextKind,
  LingCppCompletionItem
} from './types';
import { formatModulePublicType, getModulePublicTypeKind } from '../modules/modulePublicTypeService';
import { InstalledModule, LingCppModuleContext } from '../modules/types';
import { buildChineseCompletionSearchAliases } from './completionSearchAliases';

const KEYWORD = {
  public: '公开',
  if: '如果',
  ifEnd: '如果结束',
  loop: '循环',
  loopEnd: '循环结束'
};

export function getLingCppCompletionCatalog(contextKind: LingCppCompletionContextKind): LingCppCompletionCatalogItem[] {
  const keywordItems = LING_CPP_KEYWORDS.map(label => createLingCppCatalogItem({
    label,
    kind: 'keyword',
    insertText: label,
    detail: '中文 C++ 关键字',
    category: 'keyword',
    source: 'builtin',
    sortRank: 40
  }));

  const typeItems = LING_CPP_TYPES.map(label => createLingCppCatalogItem({
    label,
    kind: 'type',
    insertText: label,
    detail: '中文 C++ 类型',
    category: 'type',
    source: 'builtin',
    sortRank: 42
  }));

  const commandItems = LING_CPP_COMMANDS.map(label => createLingCppCatalogItem({
    label,
    kind: 'function',
    insertText: `${label}($1)`,
    detail: '中文 C++ 命令',
    category: 'command',
    source: 'builtin',
    sortRank: 30,
    isSnippet: true
  }));

  const common: LingCppCompletionCatalogItem[] = [
    catalogItem('信息框', 'function', '信息框("$1", 64, "提示")', '弹出一个提示框', ['MessageBox', 'msg', 'alert'], ['xxk', 'xinxikuang'], '信息框("你好", 64, "提示")', 'command', 30),
    catalogItem('调试输出', 'function', '调试输出("$1", $2)', '向输出面板写入任意数量参数，参数使用英文逗号分隔', ['DebugOutput', 'debug', 'trace', 'log'], ['ts', 'sc', 'tssc'], '调试输出("当前选择项", 控件_取选择项("列表框1"), 真)', 'command', 30),
    catalogItem('格式化文本', 'function', '格式化文本("$1：{}", $2)', '按顺序用参数替换 {} 占位符，{{ 和 }} 表示字面量花括号', ['FormatText', 'format', 'template'], ['gshwb', 'gs'], '格式化文本("姓名：{}，年龄：{}", "小林", 18)', 'command', 30, true),
    catalogItem('结束', 'function', '结束()', '结束当前程序', ['Exit', 'Quit', 'CloseApp'], ['js', 'tc'], '结束()', 'command', 30),
    catalogItem('修改控件文字', 'snippet', '$1.文字 = "$2"', '修改按钮、标签或输入框显示文字', ['SetText', 'Text'], ['xgwz', 'wz'], '按钮1.文字 = "确定"', 'snippet', 50, true),
    catalogItem('打开窗口', 'function', '打开窗口("$1")', '打开另一个窗口', ['OpenWindow', 'ShowWindow', '窗口_打开', '载入窗口', '载入新窗口'], ['dkck', 'ck', 'zrck'], '打开窗口("设置窗体")', 'command', 30),
    catalogItem('打开窗口居中', 'snippet', '打开窗口("$1", "居中")', '居中打开另一个窗口', ['OpenWindowCenter', 'ShowWindowCenter'], ['dkckjz', 'jzdk'], '打开窗口("设置窗体", "居中")', 'command', 30, true)
  ];

  const classBody: LingCppCompletionCatalogItem[] = [
    catalogItem('公开:', 'keyword', '公开:', '下面的成员和方法可以被外部访问', ['public'], ['gk'], '公开:', 'keyword', 40),
    catalogItem('构造()', 'snippet', '构造()\n    $0', '窗口初始化时执行', ['constructor', 'init'], ['gz', 'csh'], '构造()\n    调试输出("初始化完成")', 'snippet', 50, true),
    catalogItem('按钮成员', 'snippet', '按钮 $1', '声明一个按钮控件成员', ['Button'], ['an', 'btn'], '按钮 按钮1', 'type', 42, true),
    catalogItem('文本成员', 'snippet', '文本型 $1', '声明一段文本数据', ['string', 'text'], ['wb', 'wblx'], '文本型 标题', 'type', 42, true)
  ];

  const eventSnippets: LingCppCompletionCatalogItem[] = [
    catalogItem('按钮单击事件', 'event', '事件 _$1_被单击()\n    信息框("$2", 64, "提示")\n    $0', '用户点击按钮后执行', ['ButtonClick', 'ClickEvent'], ['ansj', 'dj'], '事件 _按钮1_被单击()', 'event', 50, true),
    catalogItem('窗口创建完毕事件', 'event', '事件 _$1_创建完毕()\n    调试输出("窗口创建完毕")\n    $0', '窗口创建完成后执行', ['WindowCreated', 'Created'], ['ckcj', 'csh'], '事件 _主窗体_创建完毕()', 'event', 50, true),
    catalogItem('退出确认事件', 'event', '事件 _$1_被单击()\n    如果 (信息框("确定要退出吗？", 36, "退出确认") == 6)\n        结束()\n    如果结束\n    $0', '点击按钮后询问是否退出', ['ExitConfirm', 'ConfirmExit'], ['tcqr', 'tc'], '如果用户确认就结束程序', 'event', 50, true),
    catalogItem('显示提示框事件', 'event', '事件 _$1_被单击()\n    信息框("$2", 64, "提示")\n    $0', '点击控件后弹出提示', ['ShowMessageEvent'], ['tsksj', 'xxk'], '事件 _按钮1_被单击()', 'event', 50, true)
  ];

  const flowSnippet = (label: string, insertText: string, detail: string, aliases: string[], pinyin: string[]) =>
    createLingCppCatalogItem({
      label,
      kind: 'snippet',
      insertText,
      detail,
      category: 'snippet',
      source: 'builtin',
      sortRank: 50,
      aliases,
      pinyin,
      isSnippet: true
    });
  const controlFlowSnippets: LingCppCompletionCatalogItem[] = [
    flowSnippet(KEYWORD.if, `${KEYWORD.if} ($1)\n    $0\n否则\n    \n${KEYWORD.ifEnd}`, '条件分支模板', ['if'], ['rg', 'if']),
    flowSnippet('否则如果', '否则如果 ($1)', '追加条件分支', ['elseif', 'else if'], ['fzrg']),
    flowSnippet('选择', '选择 ($1)\n    分支 ($2)\n        $0\n    默认\n        \n选择结束', '多路选择模板', ['switch', 'case'], ['xz', 'pd']),
    flowSnippet(KEYWORD.loop, `${KEYWORD.loop}\n    $0\n${KEYWORD.loopEnd}`, '无限循环模板', ['loop', 'forever'], ['xh']),
    flowSnippet('判断循环', '判断循环首 ($1)\n    $0\n判断循环尾 ()', '前置条件循环模板', ['while'], ['pdxh']),
    flowSnippet('循环判断', '循环判断首 ()\n    $0\n循环判断尾 ($1)', '后置条件循环模板', ['do while'], ['xhpd']),
    flowSnippet('计次循环', '计次循环首 ($1, $2)\n    $0\n计次循环尾 ()', '固定次数循环模板', ['for', 'repeat'], ['jcxh']),
    flowSnippet('变量循环', '变量循环首 ($1, $2, $3, $4)\n    $0\n变量循环尾 ()', '数值区间循环模板', ['range for'], ['blxh']),
    flowSnippet('枚举循环', '枚举循环首 ($1, $2)\n    $0\n枚举循环尾 ()', '集合遍历模板', ['foreach', 'for each'], ['mjxh']),
    flowSnippet('跳出循环', '跳出循环', '跳出当前循环', ['break'], ['tcxh']),
    flowSnippet('继续循环', '继续循环', '跳过本次循环并进入下一次', ['continue', '到循环尾'], ['jjxh', 'dxhw']),
    flowSnippet('尝试', '尝试\n    $0\n捕获 (错误信息)\n    \n最终\n    \n尝试结束', '异常处理模板', ['try', 'catch', 'finally'], ['cs', 'bh']),
    flowSnippet('抛出', '抛出("$1")', '主动抛出文本异常', ['throw'], ['pc'])
  ];

  const contextItems = contextKind === 'top-level'
    ? [...classBody.filter(item => item.label === '公开:'), ...eventSnippets.slice(1, 2), ...common]
    : contextKind === 'class-body' || contextKind === 'member-section'
      ? [...classBody, ...eventSnippets, ...common]
      : contextKind === 'event-body' || contextKind === 'method-body'
        ? [...common, ...controlFlowSnippets, ...eventSnippets]
        : [...common, ...classBody, ...eventSnippets, ...controlFlowSnippets];

  return dedupeLingCppCompletionItems([
    ...contextItems,
    ...controlFlowSnippets,
    ...keywordItems,
    ...typeItems,
    ...commandItems
  ]) as LingCppCompletionCatalogItem[];
}

export function getLingCppModuleCompletionItems(moduleContext?: LingCppModuleContext): LingCppCompletionCatalogItem[] {
  return getEnabledLingCppModuleContributions(moduleContext).flatMap(module => {
    const manifest = module.manifest;
    const commands: LingCppCompletionCatalogItem[] = (manifest.contributes?.commands || [])
      .filter(command => command.visibility !== 'internal' && (command.visibility !== 'advanced' || moduleContext?.showAdvancedApi === true))
      .map(command => createLingCppCatalogItem({
      label: command.name,
      kind: 'function',
      insertText: command.insertText || command.signature || `${command.name}($1)`,
      detail: `${manifest.name} · ${command.signature || '命令'}`,
      signature: command.signature,
      returnType: command.returnType,
      documentation: command.description,
      aliases: command.aliases || [],
      category: 'module',
      source: 'module',
      sortRank: 20,
      isSnippet: Boolean(command.insertText?.includes('$'))
    }));
    const types: LingCppCompletionCatalogItem[] = (manifest.contributes?.types || []).map(type => createLingCppCatalogItem({
      label: type.name,
      kind: 'type',
      insertText: type.name,
      detail: `${manifest.name} · ${getModulePublicTypeKind(type) === 'record' ? '公开记录' : getModulePublicTypeKind(type) === 'array' ? '公开数组' : '类型'}`,
      documentation: [type.description, formatModulePublicType(type), ...(type.fields || []).map(field => `${field.type}${field.isArray ? '[]' : ''} ${field.name}`)].join('\n'),
      category: 'module',
      source: 'module',
      sortRank: 20
    }));
    const snippets: LingCppCompletionCatalogItem[] = (manifest.contributes?.snippets || []).map(snippet => createLingCppCatalogItem({
      label: snippet.label,
      kind: 'snippet',
      insertText: snippet.insertText,
      detail: `${manifest.name} · 代码片段`,
      documentation: snippet.description,
      category: 'module',
      source: 'module',
      sortRank: 20,
      isSnippet: true
    }));
    return [...commands, ...types, ...snippets];
  });
}

export function getEnabledLingCppModuleContributions(moduleContext?: LingCppModuleContext): InstalledModule[] {
  return (moduleContext?.enabledModules || []).filter(module => module.diagnostics.length === 0);
}

export function createLingCppCatalogItem(
  item: LingCppCompletionItem & Pick<LingCppCompletionCatalogItem, 'source' | 'sortRank'>
): LingCppCompletionCatalogItem {
  return {
    ...item,
    pinyin: Array.from(new Set([
      ...(item.pinyin || []),
      ...buildChineseCompletionSearchAliases(item.label)
    ]))
  };
}

export function rankLingCppCompletionItems(
  items: LingCppCompletionItem[],
  contextKind: LingCppCompletionContextKind
): LingCppCompletionItem[] {
  const rankForCategory = (item: LingCppCompletionItem): number => {
    if (item.category === 'symbol') return 0;
    if (item.category === 'designer') return 10;
    if (item.category === 'module') return 20;
    if (item.category === 'command') return 30;
    if (item.category === 'keyword') return 40;
    if (item.category === 'type') return contextKind === 'class-body' || contextKind === 'member-section' ? 35 : 42;
    if (item.category === 'event') return contextKind === 'class-body' || contextKind === 'member-section' ? 12 : 50;
    return 60;
  };

  return [...items].sort((a, b) => rankForCategory(a) - rankForCategory(b) || a.label.localeCompare(b.label, 'zh-Hans-CN'));
}

export function dedupeLingCppCompletionItems(items: LingCppCompletionItem[], triggerText?: string): LingCppCompletionItem[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = `${item.kind}:${item.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    if (!triggerText) return true;
    const query = triggerText.toLowerCase();
    const haystack = [
      item.label,
      item.insertText,
      item.detail,
      item.audienceText || '',
      item.example || '',
      ...(item.aliases || []),
      ...(item.pinyin || [])
    ].join(' ').toLowerCase();
    return haystack.includes(query) || triggerText.length < 2;
  });
}

function catalogItem(
  label: string,
  kind: LingCppCompletionItem['kind'],
  insertText: string,
  audienceText: string,
  aliases: string[],
  pinyin: string[],
  example: string,
  category: NonNullable<LingCppCompletionItem['category']>,
  sortRank: number,
  isSnippet = false
): LingCppCompletionCatalogItem {
  return createLingCppCatalogItem({
    label,
    kind,
    insertText,
    detail: audienceText,
    documentation: `中文：${label}\n英文别名：${aliases.join(', ')}\n示例：${example}`,
    aliases,
    pinyin,
    example,
    category,
    audienceText,
    source: 'builtin',
    sortRank,
    isSnippet
  });
}
