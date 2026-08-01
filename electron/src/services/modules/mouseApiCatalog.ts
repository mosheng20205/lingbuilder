import type { ModuleBindingValueType } from './types';
import type { StandardCommandSpec } from './standardLibraryModules';

type MouseParameter = {
  name: string;
  type: ModuleBindingValueType;
  description: string;
};

const GLOBAL_CATEGORY = '全局真实输入（前台）';
const WINDOW_CATEGORY = '窗口消息输入（后台）';
const UIA_CATEGORY = 'UI Automation（后台）';

const GLOBAL_QUERY_NOTE = '[前台全局｜不占用系统鼠标] ';
const GLOBAL_INPUT_NOTE = '[前台全局｜占用系统鼠标] ';
const WINDOW_NOTE = '[后台窗口消息｜不占用系统鼠标] ';
const UIA_NOTE = '[后台 UI Automation｜不占用系统鼠标] ';

function parameter(name: string, type: ModuleBindingValueType, description: string): MouseParameter {
  return { name, type, description };
}

function placeholder(item: MouseParameter, index: number): string {
  if (item.type === 'wideString' || item.type === 'utf8String') return `"$${index + 1}"`;
  if (item.type === 'bool') return '假';
  return '0';
}

function command(
  category: string,
  scopeNote: string,
  name: string,
  parameters: MouseParameter[],
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

const windowHandle = parameter('窗口句柄', 'handle', '目标窗口的 HWND；不是 UI Automation 元素句柄。');
const elementHandle = parameter('元素句柄', 'handle', '本模块返回的 UI Automation 受管整数句柄；不是 HWND 或裸 COM 指针。');
const clientX = parameter('客户区横坐标', 'int', '目标窗口客户区横坐标，单位为像素。');
const clientY = parameter('客户区纵坐标', 'int', '目标窗口客户区纵坐标，单位为像素。');
const screenX = parameter('屏幕横坐标', 'int', '屏幕横坐标，单位为像素；滚轮消息使用此坐标。');
const screenY = parameter('屏幕纵坐标', 'int', '屏幕纵坐标，单位为像素；滚轮消息使用此坐标。');

export const MOUSE_COMMANDS: StandardCommandSpec[] = [
  command(GLOBAL_CATEGORY, GLOBAL_QUERY_NOTE, '鼠标_取横坐标', [], 'int', '读取真实系统光标当前屏幕横坐标；只读，不移动光标。'),
  command(GLOBAL_CATEGORY, GLOBAL_QUERY_NOTE, '鼠标_取纵坐标', [], 'int', '读取真实系统光标当前屏幕纵坐标；只读，不移动光标。'),
  command(GLOBAL_CATEGORY, GLOBAL_INPUT_NOTE, '鼠标_移动', [parameter('横坐标', 'int', '目标屏幕横坐标。'), parameter('纵坐标', 'int', '目标屏幕纵坐标。')], 'bool', '调用 SetCursorPos 移动真实系统光标；会改变用户当前光标位置。', '鼠标_移动(100, 100)'),
  command(GLOBAL_CATEGORY, GLOBAL_INPUT_NOTE, '鼠标_相对移动', [parameter('横向增量', 'int', '相对输入的横向增量；实际位移受 Windows 鼠标速度和加速度设置影响。'), parameter('纵向增量', 'int', '相对输入的纵向增量；实际位移受 Windows 鼠标速度和加速度设置影响。')], 'bool', '通过 SendInput 发送相对鼠标输入；会改变用户当前光标位置，实际位移受 Windows 鼠标速度和加速度设置影响。'),
  command(GLOBAL_CATEGORY, GLOBAL_INPUT_NOTE, '鼠标_左键按下', [], 'bool', '向当前系统输入流注入左键按下；会占用真实鼠标输入，必须与放开成对使用。'),
  command(GLOBAL_CATEGORY, GLOBAL_INPUT_NOTE, '鼠标_左键放开', [], 'bool', '向当前系统输入流注入左键放开；会占用真实鼠标输入。'),
  command(GLOBAL_CATEGORY, GLOBAL_INPUT_NOTE, '鼠标_左键单击', [], 'bool', '向当前前台窗口注入左键按下和放开；不主动切换前台，但会占用真实鼠标输入流。', '鼠标_左键单击()'),
  command(GLOBAL_CATEGORY, GLOBAL_INPUT_NOTE, '鼠标_右键按下', [], 'bool', '向当前系统输入流注入右键按下；会占用真实鼠标输入，必须与放开成对使用。'),
  command(GLOBAL_CATEGORY, GLOBAL_INPUT_NOTE, '鼠标_右键放开', [], 'bool', '向当前系统输入流注入右键放开；会占用真实鼠标输入。'),
  command(GLOBAL_CATEGORY, GLOBAL_INPUT_NOTE, '鼠标_右键单击', [], 'bool', '向当前前台窗口注入右键按下和放开；不主动切换前台，但会占用真实鼠标输入流。'),
  command(GLOBAL_CATEGORY, GLOBAL_INPUT_NOTE, '鼠标_中键按下', [], 'bool', '向当前系统输入流注入中键按下；会占用真实鼠标输入，必须与放开成对使用。'),
  command(GLOBAL_CATEGORY, GLOBAL_INPUT_NOTE, '鼠标_中键放开', [], 'bool', '向当前系统输入流注入中键放开；会占用真实鼠标输入。'),
  command(GLOBAL_CATEGORY, GLOBAL_INPUT_NOTE, '鼠标_中键单击', [], 'bool', '向当前前台窗口注入中键按下和放开；不主动切换前台，但会占用真实鼠标输入流。'),
  command(GLOBAL_CATEGORY, GLOBAL_INPUT_NOTE, '鼠标_滚轮', [parameter('滚动量', 'int', '垂直滚轮量，常用值为 120 或 -120。')], 'bool', '向当前前台窗口注入垂直滚轮；通常不移动光标，但会占用真实鼠标输入流。', '鼠标_滚轮(120)'),
  command(GLOBAL_CATEGORY, GLOBAL_INPUT_NOTE, '鼠标_水平滚轮', [parameter('滚动量', 'int', '水平滚轮量，常用值为 120 或 -120。')], 'bool', '向当前前台窗口注入水平滚轮；通常不移动光标，但会占用真实鼠标输入流。'),

  command(WINDOW_CATEGORY, WINDOW_NOTE, '鼠标_窗口消息移动', [windowHandle, clientX, clientY], 'bool', '向指定 HWND 投递 WM_MOUSEMOVE；坐标为客户区坐标，不移动真实光标，目标程序可能忽略消息。', '鼠标_窗口消息移动(目标窗口, 20, 20)'),
  command(WINDOW_CATEGORY, WINDOW_NOTE, '鼠标_窗口消息左键单击', [windowHandle, clientX, clientY], 'bool', '向指定 HWND 投递 WM_LBUTTONDOWN/UP；坐标为客户区坐标，不移动真实光标、不抢前台。'),
  command(WINDOW_CATEGORY, WINDOW_NOTE, '鼠标_窗口消息右键单击', [windowHandle, clientX, clientY], 'bool', '向指定 HWND 投递 WM_RBUTTONDOWN/UP；坐标为客户区坐标，不移动真实光标、不抢前台。'),
  command(WINDOW_CATEGORY, WINDOW_NOTE, '鼠标_窗口消息中键单击', [windowHandle, clientX, clientY], 'bool', '向指定 HWND 投递 WM_MBUTTONDOWN/UP；坐标为客户区坐标，不移动真实光标、不抢前台。'),
  command(WINDOW_CATEGORY, WINDOW_NOTE, '鼠标_窗口消息滚轮', [windowHandle, parameter('滚动量', 'int', '垂直滚轮量，常用值为 120 或 -120。'), screenX, screenY], 'bool', '向指定 HWND 投递 WM_MOUSEWHEEL；滚轮消息坐标为屏幕坐标，不移动真实光标。'),
  command(WINDOW_CATEGORY, WINDOW_NOTE, '鼠标_窗口消息水平滚轮', [windowHandle, parameter('滚动量', 'int', '水平滚轮量，常用值为 120 或 -120。'), screenX, screenY], 'bool', '向指定 HWND 投递 WM_MOUSEHWHEEL；滚轮消息坐标为屏幕坐标，不移动真实光标。'),

  command(UIA_CATEGORY, UIA_NOTE, '鼠标_UIA_按名称查找', [windowHandle, parameter('名称', 'wideString', 'UI Automation 当前名称（Name）属性。')], 'handle', '在指定 HWND 的 UI Automation 子树中按 Name 查找元素，返回受管元素句柄；不移动真实光标。', '鼠标_UIA_按名称查找(目标窗口, "确定")'),
  command(UIA_CATEGORY, UIA_NOTE, '鼠标_UIA_按自动化ID查找', [windowHandle, parameter('自动化ID', 'wideString', 'UI Automation AutomationId 属性。')], 'handle', '在指定 HWND 的 UI Automation 子树中按 AutomationId 查找元素，返回受管元素句柄；不移动真实光标。'),
  command(UIA_CATEGORY, UIA_NOTE, '鼠标_UIA_调用', [elementHandle], 'bool', '调用元素的 InvokePattern；按控件语义执行，不模拟鼠标、不移动光标。'),
  command(UIA_CATEGORY, UIA_NOTE, '鼠标_UIA_设置文本', [elementHandle, parameter('文本', 'wideString', '要写入 ValuePattern 的 Unicode 文本。')], 'bool', '通过 ValuePattern 设置元素文本；按控件语义执行，不模拟鼠标。'),
  command(UIA_CATEGORY, UIA_NOTE, '鼠标_UIA_取文本', [elementHandle], 'wideString', '读取元素的 ValuePattern 文本，缺少 ValuePattern 时回退到 Name；不模拟鼠标。'),
  command(UIA_CATEGORY, UIA_NOTE, '鼠标_UIA_设置勾选', [elementHandle, parameter('是否勾选', 'bool', '目标 ToggleState；真为选中，假为未选中。')], 'bool', '通过 TogglePattern 调整元素勾选状态；不模拟鼠标、不改变真实光标。'),
  command(UIA_CATEGORY, UIA_NOTE, '鼠标_UIA_设置焦点', [elementHandle], 'bool', '调用 UI Automation SetFocus；不移动真实光标，但可能改变键盘焦点。'),
  command(UIA_CATEGORY, UIA_NOTE, '鼠标_UIA_释放', [elementHandle], 'bool', '释放本模块持有的 UI Automation 元素句柄；不操作真实鼠标。')
];

export const MOUSE_COMMAND_NAMES = MOUSE_COMMANDS.map(item => item.name);
