import type { ModuleBindingValueType } from './types';
import type { StandardCommandSpec } from './standardLibraryModules';

type KeyboardParameter = {
  name: string;
  type: ModuleBindingValueType;
  description: string;
};

const GLOBAL_NOTE = '[全局状态｜前后台均可调用｜不占用键盘] ';
const CONVERSION_NOTE = '[本地转换｜不发送输入｜不占用键盘] ';
const FOREGROUND_NOTE = '[前台输入｜作用于当前焦点｜不独占实体键盘] ';
const WINDOW_NOTE = '[后台窗口｜指定 HWND｜不抢焦点且不占用实体键盘] ';
const COMPATIBILITY_NOTE = '[兼容入口] ';
const HOTKEY_NOTE = '[全局热键｜RegisterHotKey｜不占用实体键盘] ';


function parameter(name: string, type: ModuleBindingValueType, description: string): KeyboardParameter {
  return { name, type, description };
}

function placeholder(item: KeyboardParameter, index: number): string {
  if (item.type === 'wideString' || item.type === 'utf8String') return `"$${index + 1}"`;
  if (item.type === 'bool') return '假';
  return '0';
}

function command(
  category: string,
  scopeNote: string,
  name: string,
  parameters: KeyboardParameter[],
  returnType: ModuleBindingValueType,
  description: string,
  example?: string
): StandardCommandSpec {
  return {
    name,
    signature: `${name}(${parameters.map(item => item.name).join(', ')})`,
    description: `${scopeNote}${description}`,
    insertText: `${name}(${parameters.map(placeholder).join(', ')})`,
    parameters,
    returnType,
    category,
    example
  };
}

const virtualKey = parameter('虚拟键码', 'int', 'Win32 VK_* 虚拟键码，有效范围 1～255。');
const mainKey = parameter('主键码', 'int', '要按下的主键 Win32 虚拟键码。');
const modifier1 = parameter('修饰键码1', 'int', '第一个修饰键虚拟键码，0 表示不使用。');
const modifier2 = parameter('修饰键码2', 'int', '第二个修饰键虚拟键码，0 表示不使用。');
const modifier3 = parameter('修饰键码3', 'int', '第三个修饰键虚拟键码，0 表示不使用。');
const scanCode = parameter('扫描码', 'int', 'Win32 键盘扫描码；可包含 E0/E1 扩展前缀。');
const extended = parameter('扩展键', 'bool', '右 Ctrl、右 Alt、方向键等扩展键传真。');
const windowHandle = parameter('窗口句柄', 'handle', '接收键盘消息的 HWND；建议传入真正的焦点子控件句柄。');
const systemKey = parameter('系统键', 'bool', '真时发送 WM_SYSKEYDOWN/WM_SYSKEYUP，用于 Alt 或 F10 类组合。');

export const KEYBOARD_COMMANDS: StandardCommandSpec[] = [
  command('全局状态', GLOBAL_NOTE, '键盘_全局_键是否按下', [virtualKey], 'bool', '读取当前桌面的异步键状态；不发送按键。', '键盘_全局_键是否按下(17)'),
  command('全局状态', GLOBAL_NOTE, '键盘_全局_切换状态', [virtualKey], 'bool', '读取 Caps Lock、Num Lock、Scroll Lock 等切换键的开关位。'),
  command('全局状态', GLOBAL_NOTE, '键盘_全局_大小写锁定状态', [], 'bool', '读取 Caps Lock 开关状态。'),
  command('全局状态', GLOBAL_NOTE, '键盘_全局_数字锁定状态', [], 'bool', '读取 Num Lock 开关状态。'),
  command('全局状态', GLOBAL_NOTE, '键盘_全局_滚动锁定状态', [], 'bool', '读取 Scroll Lock 开关状态。'),
  command('全局状态', GLOBAL_NOTE, '键盘_全局_取前台窗口', [], 'handle', '返回当前接收系统输入的前台顶层窗口 HWND，没有时返回 0。'),
  command('全局状态', GLOBAL_NOTE, '键盘_全局_取前台焦点控件', [], 'handle', '返回前台线程当前具有键盘焦点的子控件 HWND，无法取得时返回 0。'),

  command('键码转换', CONVERSION_NOTE, '键盘_键名取键代码', [parameter('键名', 'wideString', '中文或英文常用键名，例如 Ctrl键、回车键、F5、A。')], 'int', '把常用键名或单字符转为 Win32 虚拟键码，无法识别时返回 0。', '键盘_键名取键代码("Ctrl键")'),
  command('键码转换', CONVERSION_NOTE, '键盘_键代码取键名', [virtualKey], 'wideString', '使用当前 Windows 键盘布局返回键名，无法识别时返回空文本。'),
  command('键码转换', CONVERSION_NOTE, '键盘_键代码取扫描码', [virtualKey], 'int', '使用当前键盘布局把虚拟键码转为扫描码。'),
  command('键码转换', CONVERSION_NOTE, '键盘_扫描码取键代码', [scanCode], 'int', '使用当前键盘布局把扫描码转为虚拟键码。'),
  command('键码转换', CONVERSION_NOTE, '键盘_键代码是否扩展键', [virtualKey], 'bool', '判断虚拟键是否需要 KEYEVENTF_EXTENDEDKEY。'),

  command('前台输入（SendInput）', FOREGROUND_NOTE, '键盘_前台_按下', [virtualKey], 'bool', '向系统输入流注入按下事件；必须与“放开”成对使用。'),
  command('前台输入（SendInput）', FOREGROUND_NOTE, '键盘_前台_放开', [virtualKey], 'bool', '向系统输入流注入放开事件。'),
  command('前台输入（SendInput）', FOREGROUND_NOTE, '键盘_前台_单击', [virtualKey], 'bool', '使用一个 SendInput 批次按下并放开指定虚拟键。', '键盘_前台_单击(13)'),
  command('前台输入（SendInput）', FOREGROUND_NOTE, '键盘_前台_组合按键', [mainKey, modifier1, modifier2, modifier3], 'bool', '批量按下最多三个修饰键和主键，再按相反顺序放开；未使用的修饰键传 0。', '键盘_前台_组合按键(83, 17, 16, 0)'),
  command('前台输入（SendInput）', FOREGROUND_NOTE, '键盘_前台_输入文本', [parameter('文本', 'wideString', '要按 UTF-16 Unicode 注入的文本，最多 32768 个代码单元。')], 'bool', '使用 KEYEVENTF_UNICODE 输入文本，不依赖当前键盘布局。', '键盘_前台_输入文本("你好 LingBuilder")'),
  command('前台输入（SendInput）', FOREGROUND_NOTE, '键盘_前台_扫描码按下', [scanCode, extended], 'bool', '按物理扫描码注入按下事件，适用于与键盘布局无关的按键。'),
  command('前台输入（SendInput）', FOREGROUND_NOTE, '键盘_前台_扫描码放开', [scanCode, extended], 'bool', '按物理扫描码注入放开事件。'),
  command('前台输入（SendInput）', FOREGROUND_NOTE, '键盘_前台_扫描码单击', [scanCode, extended], 'bool', '按物理扫描码批量注入按下和放开事件。'),

  command('后台窗口（PostMessage）', WINDOW_NOTE, '键盘_窗口_取焦点控件', [windowHandle], 'handle', '读取指定顶层窗口线程的焦点子控件 HWND；不改变焦点。'),
  command('后台窗口（PostMessage）', WINDOW_NOTE, '键盘_窗口_按下', [windowHandle, virtualKey, systemKey], 'bool', '向目标消息队列投递 WM_KEYDOWN 或 WM_SYSKEYDOWN；返回值只表示成功入队。'),
  command('后台窗口（PostMessage）', WINDOW_NOTE, '键盘_窗口_放开', [windowHandle, virtualKey, systemKey], 'bool', '向目标消息队列投递 WM_KEYUP 或 WM_SYSKEYUP；不改变全局按键状态。'),
  command('后台窗口（PostMessage）', WINDOW_NOTE, '键盘_窗口_单击', [windowHandle, virtualKey, systemKey], 'bool', '依次投递按下和放开消息；目标程序可能忽略或过滤后台消息。'),
  command('后台窗口（PostMessage）', WINDOW_NOTE, '键盘_窗口_组合按键', [windowHandle, mainKey, modifier1, modifier2, modifier3, systemKey], 'bool', '向同一目标按顺序投递最多三个修饰键和主键消息；不保证目标使用物理修饰键状态。'),
  command('后台窗口（PostMessage）', WINDOW_NOTE, '键盘_窗口_输入文本', [windowHandle, parameter('文本', 'wideString', '逐个 UTF-16 代码单元作为 WM_CHAR 投递的文本，最多 32768 个单元。')], 'bool', '向指定 HWND 投递 WM_CHAR；适用于接收文本消息的控件，不等价于真实物理按键。'),

  command('兼容入口', `${COMPATIBILITY_NOTE}${GLOBAL_NOTE}`, '键盘_键是否按下', [virtualKey], 'bool', '保留 1.x 源码兼容；等价于“键盘_全局_键是否按下”。'),
  command('兼容入口', `${COMPATIBILITY_NOTE}${GLOBAL_NOTE}`, '键盘_大小写锁定状态', [], 'bool', '保留 1.x 源码兼容；等价于全局 Caps Lock 状态查询。'),
  command('兼容入口', `${COMPATIBILITY_NOTE}${GLOBAL_NOTE}`, '键盘_数字锁定状态', [], 'bool', '保留 1.x 源码兼容；等价于全局 Num Lock 状态查询。'),
  command('兼容入口', `${COMPATIBILITY_NOTE}${FOREGROUND_NOTE}`, '键盘_单击', [virtualKey], 'bool', '保留 1.x 源码兼容；等价于“键盘_前台_单击”。'),
  command('兼容入口', `${COMPATIBILITY_NOTE}${FOREGROUND_NOTE}`, '键盘_组合按键', [parameter('修饰键码', 'int', '保留的单修饰键参数。'), mainKey], 'bool', '保留 1.x 源码兼容；仅支持一个修饰键，新代码应使用“键盘_前台_组合按键”。'),

  command('全局热键', HOTKEY_NOTE, '键盘_注册全局热键', [parameter('修饰键组合', 'int', '修饰键位掩码：1 Shift、2 Ctrl、4 Alt、8 Win，可相加组合，例如 2+4=6 表示 Ctrl+Alt。'), parameter('虚拟键码', 'int', '热键主键的 Win32 虚拟键码，有效范围 1～255。')], 'int', '注册系统范围全局热键，返回热键 ID（0 表示失败，例如组合已被其它程序占用）。热键触发时窗口会收到「全局热键被按下」事件；需在窗口创建完成后调用。', '键盘_注册全局热键(6, 71)'),
  command('全局热键', HOTKEY_NOTE, '键盘_注销全局热键', [parameter('热键ID', 'int', '键盘_注册全局热键 返回的热键 ID。')], 'bool', '注销一个全局热键；ID 不存在返回假。'),
  command('全局热键', HOTKEY_NOTE, '键盘_注销全部热键', [], 'void', '注销本进程注册的全部全局热键；进程退出时系统也会自动回收。')
];

export const KEYBOARD_COMMAND_NAMES = KEYBOARD_COMMANDS.map(item => item.name);
