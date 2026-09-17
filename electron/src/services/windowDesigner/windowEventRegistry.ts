export type LingWindowEventCategory = '生命周期' | '布局与状态' | '焦点与键盘' | '系统与拖放';

export type LingWindowEventBatch = 'common' | 'advanced';

export interface LingWindowEventParameter {
  name: string;
  type: string;
  description: string;
}

export interface LingWindowEventDefinition {
  name: string;
  label: string;
  handlerSuffix: string;
  category: LingWindowEventCategory;
  batch: LingWindowEventBatch;
  description: string;
  parameters?: LingWindowEventParameter[];
}

const parameter = (name: string, type: string, description: string): LingWindowEventParameter => ({ name, type, description });

const event = (
  name: string,
  label: string,
  handlerSuffix: string,
  category: LingWindowEventCategory,
  batch: LingWindowEventBatch,
  description: string,
  parameters?: LingWindowEventParameter[]
): LingWindowEventDefinition => ({ name, label, handlerSuffix, category, batch, description, parameters });

export const WINDOW_EVENT_DEFINITIONS: LingWindowEventDefinition[] = [
  event('Loaded', '创建完毕', '创建完毕', '生命周期', 'common', '窗口和设计器控件创建完成后触发。'),
  event('Closing', '关闭前', '关闭前', '生命周期', 'common', '窗口收到关闭请求时触发，可调用“窗口_取消关闭()”阻止本次关闭。'),
  event('Closed', '已关闭', '已关闭', '生命周期', 'common', '窗口即将释放运行时资源时触发，不能取消。'),
  event('VisibilityChanged', '显示状态被改变', '显示状态被改变', '生命周期', 'common', '窗口显示或隐藏状态发生改变时触发。'),
  event('SizeChanged', '大小被改变', '大小被改变', '布局与状态', 'common', '窗口客户区宽度或高度发生改变时触发。'),
  event('Moved', '位置被改变', '位置被改变', '布局与状态', 'common', '窗口在屏幕上的位置发生改变时触发。'),
  event('Activated', '被激活', '被激活', '布局与状态', 'common', '窗口成为活动窗口时触发。'),
  event('Deactivated', '失去激活', '失去激活', '布局与状态', 'common', '窗口不再是活动窗口时触发。'),
  event('Minimized', '被最小化', '被最小化', '布局与状态', 'advanced', '窗口从其它状态切换为最小化时触发。'),
  event('Maximized', '被最大化', '被最大化', '布局与状态', 'advanced', '窗口从其它状态切换为最大化时触发。'),
  event('Restored', '被恢复', '被恢复', '布局与状态', 'advanced', '窗口从最小化或最大化恢复为普通状态时触发。'),
  event('GotFocus', '获得焦点', '获得焦点', '焦点与键盘', 'advanced', '窗口本身获得键盘焦点时触发。'),
  event('LostFocus', '失去焦点', '失去焦点', '焦点与键盘', 'advanced', '窗口本身失去键盘焦点时触发。'),
  event('KeyDown', '按键被按下', '按键被按下', '焦点与键盘', 'advanced', '窗口或其子控件收到按键按下消息时触发。处理器参数依次为虚拟键码和 Ctrl、Shift、Alt 状态。', [
    parameter('键码', '整数型', 'Win32 虚拟键码。'),
    parameter('Ctrl键按下', '逻辑型', '事件发生时 Ctrl 键是否按下。'),
    parameter('Shift键按下', '逻辑型', '事件发生时 Shift 键是否按下。'),
    parameter('Alt键按下', '逻辑型', '事件发生时 Alt 键是否按下。')
  ]),
  event('KeyUp', '按键被放开', '按键被放开', '焦点与键盘', 'advanced', '窗口或其子控件收到按键放开消息时触发。处理器参数依次为虚拟键码和 Ctrl、Shift、Alt 状态。', [
    parameter('键码', '整数型', 'Win32 虚拟键码。'),
    parameter('Ctrl键按下', '逻辑型', '事件发生时 Ctrl 键是否按下。'),
    parameter('Shift键按下', '逻辑型', '事件发生时 Shift 键是否按下。'),
    parameter('Alt键按下', '逻辑型', '事件发生时 Alt 键是否按下。')
  ]),
  event('TextInput', '字符被输入', '字符被输入', '焦点与键盘', 'advanced', '输入法或键盘产生最终 Unicode 字符时触发，处理器参数为完整字符文本。', [
    parameter('字符', '文本型', '最终输入的 Unicode 字符；可能包含一个代理项对。')
  ]),
  event('DpiChanged', 'DPI 被改变', 'DPI被改变', '系统与拖放', 'advanced', '窗口移动到不同缩放比例的显示器后触发，处理器参数为新的 DPI。', [
    parameter('新DPI', '整数型', '窗口当前使用的每英寸点数。')
  ]),
  event('FileDropped', '文件被拖入', '文件被拖入', '系统与拖放', 'advanced', '用户把一个或多个文件或目录拖入窗口时触发，处理器参数为按拖入顺序排列的完整路径数组。', [
    parameter('文件集合', '文本型[]', '本次拖入的文件和目录完整路径，索引从 0 开始。')
  ]),
  event('HotKeyDown', '全局热键被按下', '全局热键被按下', '焦点与键盘', 'advanced', '用 键盘_注册全局热键 注册的热键在系统范围内被按下时触发，处理器参数依次为热键 ID、虚拟键码和修饰键组合。', [
    parameter('热键ID', '整数型', '注册时返回的热键 ID。'),
    parameter('键码', '整数型', '触发热键的虚拟键码。'),
    parameter('修饰键', '整数型', '修饰键组合：1 Shift、2 Ctrl、4 Alt、8 Win。')
  ])
];

export const WINDOW_EVENT_CATEGORIES: LingWindowEventCategory[] = [
  '生命周期',
  '布局与状态',
  '焦点与键盘',
  '系统与拖放'
];

export function getWindowEventDefinition(eventName: string): LingWindowEventDefinition | undefined {
  return WINDOW_EVENT_DEFINITIONS.find(definition => definition.name === eventName);
}

export function getWindowEventParameters(eventName: string): LingWindowEventParameter[] {
  return getWindowEventDefinition(eventName)?.parameters || [];
}

export function formatWindowEventParameters(eventName: string): string {
  return getWindowEventParameters(eventName)
    .map(parameter => `${parameter.type} ${parameter.name}`)
    .join('，');
}

export function getWindowEventHandlerName(className: string, eventName: string): string {
  const normalizedClassName = className.trim().replace(/\s+/g, '') || '窗口';
  const suffix = getWindowEventDefinition(eventName)?.handlerSuffix || eventName;
  return `_${normalizedClassName}_${suffix}`;
}
