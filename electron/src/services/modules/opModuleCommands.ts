import type { StandardCommandSpec } from './standardLibraryModules';
import type { ModuleCommandBindingParameter, ModuleCommandValueType } from './types';

/**
 * OP 后台图色模块（lingbuilder.op）全量命令目录。
 *
 * 事实来源：electron/native/op/op_c_api.h（上游 WallBreaker2/op 0.4.8.3，钉版）。
 * 213 条命令与上游 C API 一一对应（唯一不导出：OpSetOcrEngine——通用 OCR 由
 * lingbuilder.ocr 承担，见 docs/OP后台图色模块封装方案.md 拍板记录）。
 * 别名统一保留上游英文名，方便大漠插件用户按肌肉记忆检索。
 * 运行时函数名 = 命令名（bindings.runtimeName），实现见
 * electron/native/op/lb_op_runtime_core.cpp。
 */
type OpParameter = ModuleCommandBindingParameter & { type: ModuleCommandValueType; description: string };

type OpCommandOptions = Pick<StandardCommandSpec, 'category' | 'example' | 'returnDescription' | 'visibility'>;

const HANDLE_TEXT = '后台_创建 返回的 OP 引擎句柄。';

function opCommand(
  name: string,
  alias: string,
  parameters: OpParameter[],
  returnType: ModuleCommandValueType,
  description: string,
  options: OpCommandOptions = {}
): StandardCommandSpec {
  return {
    name,
    aliases: [alias],
    signature: `${name}(${parameters.map(parameter => parameter.name).join(', ')})`,
    description,
    insertText: `${name}(${parameters.map((parameter, index) => {
      if (parameter.type === 'wideString' || parameter.type === 'utf8String') return `"$${index + 1}"`;
      if (parameter.type === 'bool') return '假';
      return `$${index + 1}`;
    }).join(', ')})`,
    parameters,
    returnType,
    ...options
  };
}

const handleArg = (): OpParameter => ({ name: '句柄', type: 'OP句柄', description: HANDLE_TEXT });
const hwndArg = (description = '目标窗口句柄（长整数型）；由 后台_找窗口 等命令返回，或用 窗口_取自身句柄() 取本程序窗口。'): OpParameter => ({ name: '窗口句柄', type: 'longLong', description });
const intArg = (name: string, description: string): OpParameter => ({ name, type: 'int', description });
const textArg = (name: string, description: string): OpParameter => ({ name, type: 'wideString', description });
const outIntArg = (name: string, description: string): OpParameter => ({ name, type: 'int', description, byRef: true });
const regionArgs = (): OpParameter[] => [
  intArg('左上横坐标', '区域左上角横坐标（像素，绑定窗口客户区坐标系）。'),
  intArg('左上纵坐标', '区域左上角纵坐标（像素）。'),
  intArg('右下横坐标', '区域右下角横坐标（像素）。注意：右/下边界为开区间，不含该行列。'),
  intArg('右下纵坐标', '区域右下角纵坐标（像素）。注意：右/下边界为开区间，不含该行列。')
];
const outPointArgs = (): OpParameter[] => [
  outIntArg('结果横坐标', '输出：命中位置的横坐标（像素）。传入一个整数型变量接收。'),
  outIntArg('结果纵坐标', '输出：命中位置的纵坐标（像素）。传入一个整数型变量接收。')
];
const colorArg = (description = '目标颜色文本，RRGGBB 十六进制格式（如 "FF0000" 红色）；与大漠 BBGGRR 顺序相反。支持 "颜色|颜色" 多色任一与 "颜色-偏差" 形态。'): OpParameter => textArg('颜色', description);
const simArg = (hint = '常用 0.9 以上。'): OpParameter => ({ name: '相似度', type: 'double', description: `0～1，1 为完全一致；${hint}` });
const dirArg = (): OpParameter => intArg('方向', '0=从左到右、从上到下，1=从右到左、从上到下 等（扫描优先顺序）。');

// =====================================================================
// 基础与生命周期（14）
// =====================================================================
const BASIC_COMMANDS: StandardCommandSpec[] = [
  opCommand('后台_创建', 'OpCreate', [], 'OP句柄', '创建一个 OP 后台引擎实例并返回句柄；所有 后台_ 命令的第一参数都用它。操作多个目标窗口请创建多个句柄分别绑定。失败返回 0。', {
    category: '基础',
    example: '后台_创建()',
    returnDescription: '成功返回非 0 的 OP句柄，失败返回 0。'
  }),
  opCommand('后台_销毁', 'OpDestroy', [handleArg()], 'void', '销毁引擎句柄并解除后台绑定；程序退出前建议对每个句柄调用一次。', { category: '基础' }),
  opCommand('后台_取版本', 'OpVer', [], 'wideString', '返回随包 op 运行库版本（当前 0.4.8.3）。', { category: '诊断', example: '后台_取版本()' }),
  opCommand('后台_置全局路径', 'OpSetPath', [handleArg(), textArg('路径', '全局路径（图片、字库的根目录，建议绝对路径）。')], 'bool', '设置全局路径。设置后 找图/加载图片/字库 等命令可直接用相对文件名，不必每次写全路径。', { category: '基础' }),
  opCommand('后台_取全局路径', 'OpGetPath', [handleArg()], 'wideString', '返回 后台_置全局路径 设置的全局路径。', { category: '基础' }),
  opCommand('后台_取基础路径', 'OpGetBasePath', [handleArg()], 'wideString', '返回运行库内部基准路径（一般等于全局路径）；排查路径解析问题时使用。', { category: '诊断', visibility: 'advanced' }),
  opCommand('后台_取引擎编号', 'OpGetID', [handleArg()], 'int', '返回引擎实例的内部编号；多句柄排查问题时使用。', { category: '诊断', visibility: 'advanced' }),
  opCommand('后台_取错误码', 'OpGetLastError', [handleArg()], 'int', '返回该句柄最近一次底层操作的原始错误码（即 Windows GetLastError 值；0 表示无错误）。需要中文说明时配合 后台_取错误 使用。', { category: '诊断', returnDescription: 'Windows 原始错误码，0 表示无错误。' }),
  opCommand('后台_取错误', 'OpGetErrorText', [], 'wideString', '返回模块层最近一次中文错误说明（加载失败、句柄无效、调用顺序问题等；底层错误码另见 后台_取错误码）。无错误返回空文本。', { category: '诊断', example: '后台_取错误()' }),
  opCommand('后台_置错误弹窗', 'OpSetShowErrorMsg', [handleArg(), intArg('显示方式', '0=不弹窗（默认），1=出错时由运行库弹窗提示。')], 'bool', '设置底层出错时是否弹系统弹窗。建议保持默认关闭，用返回值与 后台_取错误 自行处理。', { category: '诊断', visibility: 'advanced' }),
  opCommand('后台_休眠', 'OpSleep', [handleArg(), intArg('毫秒', '暂停时长，毫秒。')], 'bool', '暂停当前线程指定毫秒（上游 Sleep 的直通封装）。界面线程中长时间休眠会冻结界面，长等待请用线程或时钟。', { category: '基础' }),
  opCommand('后台_注入DLL', 'OpInjectDll', [handleArg(), textArg('进程名', '目标进程名（如 "game.exe"）。'), textArg('DLL路径', '要注入的 DLL 完整路径。')], 'bool', '向目标进程注入指定 DLL（上游能力直通）。仅限调试自有软件；对第三方游戏/受保护进程注入可能违反其用户协议或触发反作弊，风险自负。', { category: '基础', visibility: 'advanced' }),
  opCommand('后台_置图片缓存', 'OpEnablePicCache', [handleArg(), intArg('启用', '1=开启缓存（默认），0=关闭。')], 'bool', '控制找图时是否缓存已加载模板。运行期间会变化的图片建议关闭缓存避免读到旧内容。', { category: '基础' }),
  opCommand('后台_截屏预处理', 'OpCapturePre', [handleArg(), textArg('文件名', '预处理结果图的保存路径。')], 'bool', '把当前绑定画面的预处理结果保存为文件，用于排查截图后端异常。', { category: '诊断', visibility: 'advanced' }),
  opCommand('后台_置屏幕数据模式', 'OpSetScreenDataMode', [handleArg(), intArg('模式', '屏幕数据返回模式（上游 SetScreenDataMode 取值表见其 Wiki）。')], 'bool', '调整 后台_取屏幕数据 系列的返回数据格式。普通找图找色无需调用。', { category: '基础', visibility: 'advanced' })
];

// =====================================================================
// 算法（2）
// =====================================================================
const ALGORITHM_COMMANDS: StandardCommandSpec[] = [
  opCommand('后台_A星寻路', 'OpAStarFindPath', [
    handleArg(),
    intArg('地图宽度', '地图格子列数。'),
    intArg('地图高度', '地图格子行数。'),
    textArg('禁用点', '不可通行的格子列表，形如 "x1,y1|x2,y2"；空文本表示全部可通行。'),
    intArg('起点横坐标', '起点格子列号。'),
    intArg('起点纵坐标', '起点格子行号。'),
    intArg('终点横坐标', '终点格子列号。'),
    intArg('终点纵坐标', '终点格子行号。')
  ], 'wideString', 'A 星算法求网格地图最短路径。适合挂机寻路、导航点位计算。', {
    category: '算法',
    example: '后台_A星寻路(句柄, 100, 100, "5,5|5,6", 0, 0, 99, 99)',
    returnDescription: '形如 "x1,y1|x2,y2" 的途经点文本；无路径返回空文本。'
  }),
  opCommand('后台_取最近位置', 'OpFindNearestPos', [
    handleArg(),
    textArg('位置集', '候选点列表，形如 "x1,y1|x2,y2"。'),
    intArg('类型', '0=按直线距离取最近；1=按路径取最近（上游语义）。'),
    intArg('横坐标', '参照点横坐标。'),
    intArg('纵坐标', '参照点纵坐标。')
  ], 'wideString', '从候选点集中选出离参照点最近的一个。常配合 后台_A星寻路 挑选目标点。', {
    category: '算法',
    returnDescription: '形如 "x,y" 的最近点文本；无候选返回空文本。'
  })
];

// =====================================================================
// 窗口与进程（41）
// =====================================================================
const WINDOW_COMMANDS: StandardCommandSpec[] = [
  opCommand('后台_枚举窗口', 'OpEnumWindow', [
    handleArg(),
    { name: '父窗口', type: 'longLong', description: '只枚举该父窗口的子窗口；0 表示从桌面根开始。' },
    textArg('标题', '按标题过滤；空文本不过滤。'),
    textArg('类名', '按窗口类名过滤；空文本不过滤。'),
    intArg('过滤', '1=仅可见窗口，2=仅不可见窗口，0=不过滤可见性。')
  ], 'wideString', '枚举符合条件的窗口句柄。配合 后台_取窗口标题 逐个确认目标。', {
    category: '窗口',
    example: '后台_枚举窗口(句柄, 0, "雷电模拟器", "", 1)',
    returnDescription: '形如 "句柄1|句柄2" 的窗口句柄列表文本；无匹配返回空文本。'
  }),
  opCommand('后台_按进程枚举窗口', 'OpEnumWindowByProcess', [
    handleArg(),
    textArg('进程名', '进程名（如 "game.exe"）。'),
    textArg('标题', '按标题过滤；空文本不过滤。'),
    textArg('类名', '按类名过滤；空文本不过滤。'),
    intArg('过滤', '1=仅可见窗口，2=仅不可见窗口，0=不过滤。')
  ], 'wideString', '枚举指定进程创建的全部窗口。多开场景按进程归属找各自窗口的首选入口。', {
    category: '窗口',
    returnDescription: '形如 "句柄1|句柄2" 的列表文本；无匹配返回空文本。'
  }),
  opCommand('后台_枚举进程', 'OpEnumProcess', [handleArg(), textArg('进程名', '按名称过滤（如 "game"）；空文本枚举全部。')], 'wideString', '枚举系统进程。', {
    category: '窗口',
    returnDescription: '"进程名|进程ID" 列表文本。'
  }),
  opCommand('后台_客户区转屏幕', 'OpClientToScreen', [handleArg(), hwndArg(), outIntArg('横坐标', '输入客户区横坐标，输出屏幕横坐标。'), outIntArg('纵坐标', '输入客户区纵坐标，输出屏幕纵坐标。')], 'bool', '把窗口客户区坐标换算为屏幕坐标（就地改写传入变量）。'),
  opCommand('后台_找窗口', 'OpFindWindow', [handleArg(), textArg('类名', '窗口类名；空文本不过滤。'), textArg('标题', '窗口标题；空文本不过滤。')], 'longLong', '按类名/标题查找顶层窗口。', {
    category: '窗口',
    example: '后台_找窗口(句柄, "", "记事本")',
    returnDescription: '窗口句柄；未找到返回 0。'
  }),
  opCommand('后台_按进程找窗口', 'OpFindWindowByProcess', [handleArg(), textArg('进程名', '进程名（如 "game.exe"）。'), textArg('类名', '窗口类名；空文本不过滤。'), textArg('标题', '窗口标题；空文本不过滤。')], 'longLong', '按进程名+类名/标题查找窗口；多开场景建议用 后台_按进程枚举窗口 全量确认后再选。', { category: '窗口', returnDescription: '窗口句柄；未找到返回 0。' }),
  opCommand('后台_按进程ID找窗口', 'OpFindWindowByProcessId', [handleArg(), intArg('进程ID', '进程 PID。'), textArg('类名', '窗口类名；空文本不过滤。'), textArg('标题', '窗口标题；空文本不过滤。')], 'longLong', '按进程 PID 查找窗口。', { category: '窗口', returnDescription: '窗口句柄；未找到返回 0。' }),
  opCommand('后台_找子窗口', 'OpFindWindowEx', [handleArg(), { name: '父窗口', type: 'longLong', description: '父窗口句柄；0 表示桌面。' }, textArg('类名', '子窗口类名；空文本不过滤。'), textArg('标题', '子窗口标题；空文本不过滤。')], 'longLong', '在父窗口下查找子窗口（模拟器渲染子窗口、嵌套控件窗口常用）。', { category: '窗口', returnDescription: '子窗口句柄；未找到返回 0。' }),
  opCommand('后台_取窗口客户区', 'OpGetClientRect', [handleArg(), hwndArg(), outIntArg('左', '输出：客户区左边界。'), outIntArg('上', '输出：客户区上边界。'), outIntArg('右', '输出：客户区右边界。'), outIntArg('下', '输出：客户区下边界。')], 'bool', '取窗口客户区矩形（就地写回四个变量）。找图区域通常取客户区范围。'),
  opCommand('后台_取客户区尺寸', 'OpGetClientSize', [handleArg(), hwndArg(), outIntArg('宽度', '输出：客户区宽（像素）。'), outIntArg('高度', '输出：客户区高（像素）。')], 'bool', '取窗口客户区宽高（就地写回两个变量）。'),
  opCommand('后台_取前台焦点', 'OpGetForegroundFocus', [handleArg()], 'longLong', '返回当前持有键盘焦点的窗口句柄。', { category: '窗口', returnDescription: '窗口句柄。' }),
  opCommand('后台_取前台窗口', 'OpGetForegroundWindow', [handleArg()], 'longLong', '返回当前前台活动窗口句柄。', { category: '窗口', returnDescription: '窗口句柄。' }),
  opCommand('后台_取鼠标所在窗口', 'OpGetMousePointWindow', [handleArg()], 'longLong', '返回当前鼠标光标下的窗口句柄。', { category: '窗口', returnDescription: '窗口句柄。' }),
  opCommand('后台_取坐标处窗口', 'OpGetPointWindow', [handleArg(), intArg('横坐标', '屏幕横坐标。'), intArg('纵坐标', '屏幕纵坐标。')], 'longLong', '返回指定屏幕坐标处的窗口句柄。', { category: '窗口', returnDescription: '窗口句柄。' }),
  opCommand('后台_取进程信息', 'OpGetProcessInfo', [handleArg(), intArg('进程ID', '进程 PID。')], 'wideString', '返回进程信息文本（路径等）。', { category: '窗口' }),
  opCommand('后台_取特殊窗口', 'OpGetSpecialWindow', [handleArg(), intArg('标志', '1=桌面窗口，2=Shell 窗口 等。')], 'longLong', '取桌面等特殊系统窗口句柄。', { category: '窗口', returnDescription: '窗口句柄。' }),
  opCommand('后台_取关联窗口', 'OpGetWindow', [handleArg(), hwndArg(), intArg('标志', '关系标志：1=父窗口，2=第一个子窗口，3=上一个兄弟，4=下一个兄弟，5=拥有者窗口 等。')], 'longLong', '按关系取关联窗口（父/子/兄弟/拥有者）。', { category: '窗口', returnDescription: '关联窗口句柄。' }),
  opCommand('后台_取窗口类名', 'OpGetWindowClass', [handleArg(), hwndArg()], 'wideString', '返回窗口的 Win32 类名。', { category: '窗口' }),
  opCommand('后台_取窗口进程ID', 'OpGetWindowProcessId', [handleArg(), hwndArg()], 'int', '返回窗口所属进程 PID。', { category: '窗口', returnDescription: '进程 PID；句柄无效返回 0。' }),
  opCommand('后台_取窗口进程路径', 'OpGetWindowProcessPath', [handleArg(), hwndArg()], 'wideString', '返回窗口所属进程的 exe 完整路径。', { category: '窗口' }),
  opCommand('后台_取窗口矩形', 'OpGetWindowRect', [handleArg(), hwndArg(), outIntArg('左', '输出：窗口左边界（屏幕坐标）。'), outIntArg('上', '输出：窗口上边界。'), outIntArg('右', '输出：窗口右边界。'), outIntArg('下', '输出：窗口下边界。')], 'bool', '取窗口矩形（屏幕坐标，就地写回四个变量）。'),
  opCommand('后台_取窗口状态', 'OpGetWindowState', [handleArg(), hwndArg(), intArg('标志', '1=是否存在，2=是否可见，3=是否前台，4=是否最小化，5=是否最大化，6=是否正常化 等。')], 'bool', '查询窗口状态（真=满足该状态）。'),
  opCommand('后台_取窗口标题', 'OpGetWindowTitle', [handleArg(), hwndArg()], 'wideString', '返回窗口标题文本。', { category: '窗口' }),
  opCommand('后台_移动窗口', 'OpMoveWindow', [handleArg(), hwndArg(), intArg('横坐标', '新位置横坐标（屏幕）。'), intArg('纵坐标', '新位置纵坐标（屏幕）。')], 'bool', '移动窗口位置（不改大小）。'),
  opCommand('后台_屏幕转客户区', 'OpScreenToClient', [handleArg(), hwndArg(), outIntArg('横坐标', '输入屏幕横坐标，输出客户区横坐标。'), outIntArg('纵坐标', '输入屏幕纵坐标，输出客户区纵坐标。')], 'bool', '把屏幕坐标换算为窗口客户区坐标（就地改写传入变量）。'),
  opCommand('后台_发送粘贴', 'OpSendPaste', [handleArg(), hwndArg()], 'bool', '向窗口发送 Ctrl+V 粘贴消息；配合 后台_置剪贴板 实现向目标窗口后台粘贴文本。'),
  opCommand('后台_置客户区尺寸', 'OpSetClientSize', [handleArg(), hwndArg(), intArg('宽度', '目标客户区宽（像素）。'), intArg('高度', '目标客户区高（像素）。')], 'bool', '按客户区目标尺寸调整窗口（自动补偿边框/标题栏）。'),
  opCommand('后台_置窗口状态', 'OpSetWindowState', [handleArg(), hwndArg(), intArg('标志', '1=最小化，2=最大化，3=还原，4=可见，5=隐藏，6=置顶，7=取消置顶，8=关闭，9=激活前台 等。')], 'bool', '设置窗口状态。注意：多数截图后端在窗口最小化后仍可截图，具体以后端实测为准。'),
  opCommand('后台_置窗口尺寸', 'OpSetWindowSize', [handleArg(), hwndArg(), intArg('宽度', '窗口总宽（含边框）。'), intArg('高度', '窗口总高（含标题栏）。')], 'bool', '按总尺寸调整窗口大小。'),
  opCommand('后台_排列窗口', 'OpLayoutWindows', [
    handleArg(),
    textArg('窗口句柄集', '要排列的窗口句柄列表，形如 "句柄1|句柄2"。'),
    intArg('布局方式', '0=网格，1=横向平铺，2=纵向平铺 等。'),
    intArg('列数', '网格布局的列数。'),
    intArg('起始横坐标', '排列区域起点横坐标（屏幕）。'),
    intArg('起始纵坐标', '排列区域起点纵坐标（屏幕）。'),
    intArg('间距横', '窗口之间的横向间距。'),
    intArg('间距纵', '窗口之间的纵向间距。'),
    intArg('尺寸模式', '0=保持原尺寸，1=按格子拉伸。'),
    intArg('窗口宽度', '固定宽模式的窗口宽。'),
    intArg('窗口高度', '固定高模式的窗口高。'),
    intArg('锚点模式', '0=左上角对齐格子，1=居中 等。')
  ], 'bool', '把多开的一组窗口按网格/平铺批量排布到屏幕区域，多开挂机摆位一次完成。'),
  opCommand('后台_置窗口标题', 'OpSetWindowText', [handleArg(), hwndArg(), textArg('标题', '新的窗口标题。')], 'bool', '修改窗口标题。'),
  opCommand('后台_置窗口透明', 'OpSetWindowTransparent', [handleArg(), hwndArg(), intArg('透明度', '0=全透明，255=不透明。')], 'bool', '设置窗口整体透明度（仅分层窗口样式生效）。'),
  opCommand('后台_发文本', 'OpSendString', [handleArg(), hwndArg(), textArg('文本', '要发送的文本内容。')], 'bool', '以窗口消息方式向目标窗口发送文本（后台输入，不经输入法）。'),
  opCommand('后台_发文本输入法', 'OpSendStringIme', [handleArg(), hwndArg(), textArg('文本', '要发送的文本内容。')], 'bool', '以输入法（IME）消息方式向目标窗口发送中文文本；目标程序只认输入法输入时用这条。'),
  opCommand('后台_运行程序', 'OpRunApp', [
    handleArg(),
    textArg('命令行', '完整命令行（含程序路径与参数）。'),
    intArg('显示模式', '0=隐藏，1=正常，3=最大化，6=最小化。'),
    { name: '进程ID', type: 'longLong', description: '输出：新进程 PID。传入一个长整数型变量接收。', byRef: true }
  ], 'bool', '启动程序并取回进程 PID（就地写回 进程ID 变量）。常用于拉起模拟器后立刻找它的窗口。', {
    category: '窗口',
    returnDescription: '真=启动成功。'
  }),
  opCommand('后台_执行命令', 'OpWinExec', [handleArg(), textArg('命令行', '完整命令行。'), intArg('显示方式', '0=隐藏，1=正常，3=最大化，6=最小化。')], 'bool', '启动程序（不取 PID 的轻量形态）。'),
  opCommand('后台_取命令输出', 'OpGetCmdStr', [handleArg(), textArg('命令', '要执行的命令行。'), intArg('超时毫秒', '等待命令结束的超时时间，毫秒。')], 'wideString', '执行命令行并返回其标准输出文本（内部捕获，控制台窗口不弹出）。', {
    category: '窗口',
    returnDescription: '命令的标准输出文本。'
  }),
  opCommand('后台_置剪贴板', 'OpSetClipboard', [handleArg(), textArg('文本', '写入剪贴板的文本。')], 'bool', '把文本写入系统剪贴板；配合 后台_发送粘贴 可向目标窗口后台粘贴。'),
  opCommand('后台_取剪贴板', 'OpGetClipboard', [handleArg()], 'wideString', '读取系统剪贴板文本内容。', { category: '窗口' }),
  opCommand('后台_延迟', 'OpDelay', [handleArg(), intArg('毫秒', '暂停时长，毫秒。')], 'bool', '让当前线程暂停指定毫秒；挂机脚本里做步骤间隔的常规选择。'),
  opCommand('后台_随机延迟', 'OpDelays', [handleArg(), intArg('最小毫秒', '随机区间下限，毫秒。'), intArg('最大毫秒', '随机区间上限，毫秒。')], 'bool', '在 [最小,最大] 毫秒区间内随机暂停；比固定延迟更接近人工节奏。')
];

// =====================================================================
// 后台绑定（6）
// =====================================================================
const BIND_COMMANDS: StandardCommandSpec[] = [
  opCommand('后台_绑定窗口', 'OpBindWindow', [
    handleArg(),
    hwndArg(),
    textArg('显示后端', '截图后端：normal（前台屏）/ gdi / gdi2 / dxgi / wgc（Win10 1903+）/ dx.d3d9 / dx.d3d10 / dx.d3d11 / dx.d3d12 / opengl / opengl.nox（夜神模拟器）/ normal.auto（自动选型）。'),
    textArg('鼠标模式', 'normal=前台真实鼠标 / windows=后台消息鼠标 / dx=注入式鼠标。'),
    textArg('键盘模式', 'normal / normal.hd（硬件级）/ windows / dx。'),
    intArg('绑定模式', '0=默认。预留扩展参数，常规传 0。')
  ], 'bool', '把目标窗口绑定为本引擎的后台操作对象：之后的截图/找图/找色/键鼠命令都作用于该窗口，窗口被遮挡、失焦仍可操作。绑定失败读 后台_取错误 排查（常见原因：后端与目标渲染方式不符，换 gdi2 或 dx.d3d11 再试）。', {
    category: '绑定',
    example: '后台_绑定窗口(句柄, 窗口句柄, "gdi", "windows", "windows", 0)',
    returnDescription: '真=绑定成功。'
  }),
  opCommand('后台_绑定窗口扩展', 'OpBindWindowEx', [
    handleArg(),
    { name: '显示窗口句柄', type: 'longLong', description: '截图来源窗口（画面真正渲染的窗口）。' },
    { name: '输入窗口句柄', type: 'longLong', description: '接收键鼠消息的窗口。' },
    textArg('显示后端', '同 后台_绑定窗口 的显示后端。'),
    textArg('鼠标模式', '同 后台_绑定窗口。'),
    textArg('键盘模式', '同 后台_绑定窗口。'),
    intArg('绑定模式', '0=默认。')
  ], 'bool', '显示/输入分离的扩展绑定：截图窗口与收输入窗口不是同一个时使用（模拟器多层窗口、嵌套浏览器内核、游戏渲染子窗口）。普通窗口用 后台_绑定窗口 即可。', {
    category: '绑定',
    returnDescription: '真=绑定成功。'
  }),
  opCommand('后台_解绑窗口', 'OpUnBindWindow', [handleArg()], 'bool', '解除当前绑定；换绑新窗口前或退出前调用。', { category: '绑定' }),
  opCommand('后台_锁定输入', 'OpLockInput', [handleArg(), intArg('锁定方式', '1=锁定全部键鼠（需鼠标键盘均为 dx 模式），2=仅锁鼠标，3=仅锁键盘，0=解除锁定。')], 'bool', '脚本运行期间屏蔽真实键鼠进入目标窗口，防止人手干扰；解除传 0。', { category: '绑定' }),
  opCommand('后台_取绑定窗口', 'OpGetBindWindow', [handleArg()], 'longLong', '返回当前绑定的窗口句柄。', { category: '绑定', returnDescription: '绑定窗口句柄；未绑定返回 0。' }),
  opCommand('后台_是否已绑定', 'OpIsBind', [handleArg()], 'bool', '判断该引擎是否已成功绑定窗口（真=已绑定）。', { category: '绑定' })
];

// =====================================================================
// 鼠标（35）
// =====================================================================
const BUTTON_DEFS: Array<[string, string, string]> = [
  ['左键', 'OpLeft', '左键（主按钮）'],
  ['中键', 'OpMiddle', '中键（滚轮键）'],
  ['右键', 'OpRight', '右键（次按钮）'],
  ['侧键1', 'OpXButton1', '侧键1（XButton1 扩展键）'],
  ['侧键2', 'OpXButton2', '侧键2（XButton2 扩展键）']
];
const ACTION_DEFS: Array<[string, string, string]> = [
  ['单击', 'Click', '执行一次按下并立即弹起'],
  ['双击', 'DoubleClick', '执行快速连续两次单击'],
  ['按下', 'Down', '只按下不弹起，配合对应弹起命令实现按住拖动'],
  ['弹起', 'Up', '弹起已按下的按键']
];
const MOUSE_COMMANDS: StandardCommandSpec[] = [
  opCommand('后台_取鼠标位置', 'OpGetCursorPos', [handleArg(), outIntArg('横坐标', '输出：当前鼠标横坐标。'), outIntArg('纵坐标', '输出：当前鼠标纵坐标。')], 'bool', '取当前鼠标位置（前台真实鼠标）。'),
  opCommand('后台_取鼠标形状', 'OpGetCursorShape', [handleArg()], 'wideString', '返回当前鼠标光标形状特征文本；部分游戏以光标形状区分可点/不可点状态。'),
  opCommand('后台_相对移动', 'OpMoveR', [handleArg(), intArg('横偏移', '相对当前位置的横向偏移（可为负）。'), intArg('纵偏移', '相对当前位置的纵向偏移（可为负）。')], 'bool', '鼠标按偏移量相对移动。'),
  opCommand('后台_移动到', 'OpMoveTo', [handleArg(), intArg('横坐标', '目标横坐标（绑定窗口客户区坐标）。'), intArg('纵坐标', '目标纵坐标。')], 'bool', '鼠标移动到指定坐标（瞬时到位；需要拟人轨迹用 后台_平滑移动）。'),
  opCommand('后台_区域随机移动', 'OpMoveToEx', [handleArg(), intArg('横坐标', '区域左上角横坐标。'), intArg('纵坐标', '区域左上角纵坐标。'), intArg('宽度', '区域宽。'), intArg('高度', '区域高。')], 'wideString', '鼠标移动到指定区域内的随机一点（反固定坐标检测常用）。', { returnDescription: '实际落点 "x,y" 文本。' }),
  opCommand('后台_平滑移动', 'OpMoveToSmooth', [handleArg(), intArg('横坐标', '目标横坐标。'), intArg('纵坐标', '目标纵坐标。'), intArg('时长毫秒', '移动过程时长，毫秒。')], 'bool', '鼠标在指定时长内平滑滑到目标点（轨迹拟人，风格可用 后台_置鼠标轨迹 调整）。'),
  opCommand('后台_区域随机平滑移动', 'OpMoveToExSmooth', [handleArg(), intArg('横坐标', '区域左上角横坐标。'), intArg('纵坐标', '区域左上角纵坐标。'), intArg('宽度', '区域宽。'), intArg('高度', '区域高。'), intArg('时长毫秒', '移动过程时长，毫秒。')], 'wideString', '平滑移动到区域内随机一点。', { returnDescription: '实际落点 "x,y" 文本。' }),
  opCommand('后台_轨迹移动', 'OpMovePath', [handleArg(), textArg('路径点', '途经点列表，形如 "x1,y1|x2,y2"。'), intArg('时长毫秒', '全程时长，毫秒。')], 'bool', '鼠标沿给定途经点序列依次平滑移动；需要精确走位路线时用。'),
  opCommand('后台_拖拽路径', 'OpDragPath', [handleArg(), textArg('路径点', '途经点列表，形如 "x1,y1|x2,y2"。'), intArg('时长毫秒', '全程时长，毫秒。')], 'bool', '按住左键沿路径拖动（起点按下、终点弹起），用于滑块、拖拽类操作。'),
  opCommand('后台_置鼠标轨迹', 'OpSetMouseTrajectory', [handleArg(), intArg('模式', '轨迹风格模式。'), intArg('最小时长', '随机时长下限，毫秒。'), intArg('最大时长', '随机时长上限，毫秒。'), intArg('抖动', '轨迹随机抖动幅度（像素）。'), intArg('起始延迟', '移动开始前的随机延迟上限，毫秒。'), intArg('结束延迟', '移动结束后的随机延迟上限，毫秒。')], 'bool', '配置平滑/轨迹移动的拟人化参数（时长区间、抖动、起止延迟）；设置一次对后续移动全局生效。'),
  opCommand('后台_置鼠标延迟', 'OpSetMouseDelay', [handleArg(), textArg('类型', '延迟作用对象（如 "normal"、"windows"、"dx"）。'), intArg('延迟毫秒', '每次鼠标动作之间的插入延迟，毫秒。')], 'bool', '配置指定模式下鼠标动作之间的自动间隔。'),
  ...BUTTON_DEFS.flatMap<StandardCommandSpec>(([cn, prefix, desc]) => ACTION_DEFS.map(([actionCn, actionEn, actionCore]) => opCommand(
    `后台_${cn}${actionCn}`,
    `${prefix}${actionEn}`,
    [handleArg()],
    'bool',
    `${desc}的${actionCn}：${actionCore}。作用于后台绑定的目标窗口（windows 模式发窗口消息，dx 模式走注入）。`,
    { category: '鼠标' }
  ))),
  opCommand('后台_滚轮滚动', 'OpWheel', [handleArg(), intArg('增量', '滚动量；正值向前（远离用户），负值向后。一个刻度通常 120。')], 'bool', '后台滚动垂直滚轮。'),
  opCommand('后台_水平滚轮滚动', 'OpHWheel', [handleArg(), intArg('增量', '滚动量；正值向右，负值向左。')], 'bool', '后台滚动水平滚轮（倾斜滚轮/触控板横向滚动场景）。'),
  opCommand('后台_滚轮向下', 'OpWheelDown', [handleArg()], 'bool', '后台滚轮向后滚一个刻度（等价 后台_滚轮滚动(句柄, -120)）。'),
  opCommand('后台_滚轮向上', 'OpWheelUp', [handleArg()], 'bool', '后台滚轮向前滚一个刻度（等价 后台_滚轮滚动(句柄, 120)）。')
];

// =====================================================================
// 键盘（10）
// =====================================================================
const KEYPAD_COMMANDS: StandardCommandSpec[] = [
  opCommand('后台_取按键状态', 'OpGetKeyState', [handleArg(), intArg('虚拟键码', 'Windows 虚拟键码（如 65=A，13=回车，27=ESC）。')], 'bool', '查询指定键当前是否处于按下状态（真=按下）。'),
  opCommand('后台_按下按键', 'OpKeyDown', [handleArg(), intArg('虚拟键码', 'Windows 虚拟键码。')], 'bool', '向绑定窗口发送按键按下（不弹起）；组合键用两次按下+两次弹起组合实现。'),
  opCommand('后台_按字符按下', 'OpKeyDownChar', [handleArg(), textArg('字符', '单个字符（如 "A"、"1"）。')], 'bool', '按字符形态发送按键按下（内部换算虚拟键码）。'),
  opCommand('后台_弹起按键', 'OpKeyUp', [handleArg(), intArg('虚拟键码', 'Windows 虚拟键码。')], 'bool', '弹起指定键；与 后台_按下按键 成对使用。'),
  opCommand('后台_按字符弹起', 'OpKeyUpChar', [handleArg(), textArg('字符', '单个字符。')], 'bool', '按字符形态弹起按键。'),
  opCommand('后台_等待按键', 'OpWaitKey', [handleArg(), intArg('虚拟键码', '要等待的虚拟键码。'), intArg('超时毫秒', '最长等待时间，毫秒。')], 'bool', '阻塞等待指定键被按下；超时返回假。界面线程慎用长超时。'),
  opCommand('后台_敲击按键', 'OpKeyPress', [handleArg(), intArg('虚拟键码', 'Windows 虚拟键码。')], 'bool', '一次完整的按下+弹起（最常用的单键后台输入）。', {
    category: '键盘',
    example: '后台_敲击按键(句柄, 13)'
  }),
  opCommand('后台_按字符敲击', 'OpKeyPressChar', [handleArg(), textArg('字符', '单个字符。')], 'bool', '按字符形态做一次按下+弹起。'),
  opCommand('后台_置键盘延迟', 'OpSetKeypadDelay', [handleArg(), textArg('类型', '延迟作用对象（如 "normal"、"windows"、"dx"）。'), intArg('延迟毫秒', '按键动作之间的插入延迟，毫秒。')], 'bool', '配置指定模式下键盘动作之间的自动间隔。'),
  opCommand('后台_连发按键串', 'OpKeyPressStr', [handleArg(), textArg('按键串', '要连发的字符序列（如 "abc123"）。'), intArg('间隔毫秒', '每两次按键之间的间隔，毫秒。')], 'bool', '按指定间隔逐个敲入一串字符（后台打字）。中文内容请用 后台_发文本输入法。')
];

// =====================================================================
// 图色（22）
// =====================================================================
const IMAGE_COMMANDS: StandardCommandSpec[] = [
  opCommand('后台_截图', 'OpCapture', [handleArg(), ...regionArgs(), textArg('文件名', '保存路径（BMP 格式；建议绝对路径或先设全局路径）。')], 'bool', '把绑定窗口的指定区域截图保存为图片文件。区域右/下边界为开区间（不含该行/列）。最小化/遮挡状态下能否截到取决于绑定后端。', {
    category: '图色',
    example: '后台_截图(句柄, 0, 0, 399, 299, "shots/场景.bmp")'
  }),
  opCommand('后台_比色', 'OpCmpColor', [handleArg(), intArg('横坐标', '要检查的点横坐标。'), intArg('纵坐标', '要检查的点纵坐标。'), colorArg('目标颜色，RRGGBB 格式。'), simArg()], 'bool', '判断指定点的颜色是否与目标颜色在相似度内一致（真=一致）。', { category: '图色' }),
  opCommand('后台_找色', 'OpFindColor', [
    handleArg(), ...regionArgs(),
    colorArg('要找的颜色，RRGGBB 格式。'),
    simArg(),
    dirArg(),
    ...outPointArgs()
  ], 'bool', '在绑定画面区域内查找指定颜色，命中第一个点并把坐标写回传入的两个整数型变量。', {
    category: '图色',
    example: '后台_找色(句柄, 0, 0, 399, 299, "FF0000", 0.9, 0, 红点横, 红点纵)',
    returnDescription: '真=找到；坐标经 结果横坐标/结果纵坐标 参数写回。'
  }),
  opCommand('后台_找色全部', 'OpFindColorEx', [handleArg(), ...regionArgs(), colorArg(), simArg(), dirArg()], 'wideString', '查找区域内全部命中点。用于数点、排队列等需要全部位置的场合。', {
    category: '图色',
    returnDescription: '形如 "x1,y1|x2,y2" 的全部命中点文本；未找到返回空文本。'
  }),
  opCommand('后台_多点找色', 'OpFindMultiColor', [
    handleArg(), ...regionArgs(),
    textArg('首色', '第一个点的颜色，RRGGBB 格式。'),
    textArg('偏移色', '相对第一个点的偏移颜色描述，形如 "横偏,纵偏,颜色,横偏,纵偏,颜色"（如 "2,0,FFFFFF,0,3,000000"，负偏移直接写负号）。'),
    simArg('作用于全部颜色点。'),
    dirArg(),
    ...outPointArgs()
  ], 'bool', '按「首色+一组相对偏移颜色」的组合特征查找（比单点找色稳得多，是识别按钮/图标的标准手段）；命中后把首色点坐标写回两个变量。', {
    category: '图色',
    returnDescription: '真=找到组合特征；坐标写回结果参数。'
  }),
  opCommand('后台_多点找色全部', 'OpFindMultiColorEx', [
    handleArg(), ...regionArgs(),
    textArg('首色', '第一个点的颜色。'),
    textArg('偏移色', '偏移颜色描述，同 后台_多点找色。'),
    simArg(),
    dirArg()
  ], 'wideString', '返回区域内全部组合特征命中点（列表上多个相同按钮一次找齐）。', {
    category: '图色',
    returnDescription: '形如 "x1,y1|x2,y2" 的全部命中点文本；未找到返回空文本。'
  }),
  opCommand('后台_找图', 'OpFindPic', [
    handleArg(), ...regionArgs(),
    textArg('图片集', '模板图片文件名（BMP/PNG）；多张用 "|" 分隔（如 "开始.bmp|继续.bmp"）。已设全局路径可写相对名。'),
    textArg('偏差色', '每通道允许的颜色偏差 "RRGGBB"；空文本按相似度自动换算。'),
    simArg('常用 0.8～0.95。'),
    dirArg(),
    ...outPointArgs()
  ], 'bool', '在绑定画面中查找模板图片（透明色模板自动支持），命中位置写回两个变量。多模板场景想知道命中哪张时改用 后台_找图全部。', {
    category: '图色',
    example: '后台_找图(句柄, 0, 0, 399, 299, "开始按钮.bmp", "", 0.9, 0, 按钮横, 按钮纵)',
    returnDescription: '真=找到任一模板；坐标写回结果参数。'
  }),
  opCommand('后台_找图全部', 'OpFindPicEx', [
    handleArg(), ...regionArgs(),
    textArg('图片集', '模板文件名，多张用 "|" 分隔。'),
    textArg('偏差色', '颜色偏差；空文本按相似度换算。'),
    simArg(),
    dirArg()
  ], 'wideString', '查找全部命中结果——能同时知道命中了哪张模板与位置（区分多个按钮、统计数量）。', {
    category: '图色',
    returnDescription: '"文件名,x,y|文件名,x,y" 文本；未找到返回空文本。'
  }),
  opCommand('后台_找图全部编号', 'OpFindPicExS', [
    handleArg(), ...regionArgs(),
    textArg('图片集', '模板文件名，多张用 "|" 分隔。'),
    textArg('偏差色', '颜色偏差；空文本按相似度换算。'),
    simArg(),
    dirArg()
  ], 'wideString', '同 后台_找图全部，但结果里用模板序号（0 起）代替文件名，按序号分支处理更直接。', {
    category: '图色',
    returnDescription: '"序号,x,y|序号,x,y" 文本；未找到返回空文本。'
  }),
  opCommand('后台_色块找色', 'OpFindColorBlock', [
    handleArg(), ...regionArgs(),
    colorArg('组成色块的目标颜色。'),
    simArg(),
    intArg('最少像素数', '构成色块的最少像素数（低于该数的散点忽略）。'),
    intArg('最小高度', '色块区域的最小高度（像素）。'),
    intArg('最小宽度', '色块区域的最小宽度（像素）。'),
    ...outPointArgs()
  ], 'bool', '查找满足「颜色连续聚集成块（不少于指定像素数、宽高达标）」的区域，把色块位置写回两个变量。识别血条、加载块、地图色斑常用。', { category: '图色' }),
  opCommand('后台_色块找色全部', 'OpFindColorBlockEx', [
    handleArg(), ...regionArgs(),
    colorArg('组成色块的目标颜色。'),
    simArg(),
    intArg('最少像素数', '最少像素数。'),
    intArg('最小高度', '最小高度。'),
    intArg('最小宽度', '最小宽度。')
  ], 'wideString', '返回全部满足条件的色块位置。', {
    category: '图色',
    returnDescription: '形如 "x1,y1|x2,y2" 的全部色块位置文本；未找到返回空文本。'
  }),
  opCommand('后台_取颜色', 'OpGetColor', [handleArg(), intArg('横坐标', '要取色的点横坐标。'), intArg('纵坐标', '要取色的点纵坐标。')], 'wideString', '读取绑定画面指定点的颜色（与大漠 BBGGRR 顺序相反，注意对比脚本迁移）。', {
    category: '图色',
    example: '后台_取颜色(句柄, 100, 100)',
    returnDescription: '"RRGGBB" 颜色文本。'
  }),
  opCommand('后台_颜色计数', 'OpGetColorNum', [handleArg(), ...regionArgs(), colorArg(), simArg()], 'int', '统计区域内与目标颜色匹配的像素数量（血量估算、加载进度估算常用）。', { category: '图色', returnDescription: '命中像素数。' }),
  opCommand('后台_置显示输入模式', 'OpSetDisplayInput', [handleArg(), textArg('模式', '显示输入模式名（上游 SetDisplayInput 取值）。')], 'bool', '运行期切换截图来源模式（绑定后想换后端的轻量入口；多数场景应重新绑定）。', { category: '基础', visibility: 'advanced' }),
  opCommand('后台_加载图片', 'OpLoadPic', [handleArg(), textArg('文件名', '模板图片路径（或全局路径下的相对名）。')], 'bool', '把模板图片预先加载进内存缓存，后续找图直接命中缓存（反复找同一图的性能优化）。', { category: '图色' }),
  opCommand('后台_释放图片', 'OpFreePic', [handleArg(), textArg('文件名', '要释放的模板名。')], 'bool', '从缓存释放指定模板图片。', { category: '图色' }),
  opCommand('后台_加载内存图片', 'OpLoadMemPic', [handleArg(), textArg('名称', '给这份内存模板起的名字（后续找图的图片集里引用）。'), { name: '图片数据', type: 'bytes', description: '图片文件内容字节集（BMP/PNG 等）。' }], 'bool', '把字节集图片注册为找图模板——模板可从网络下载或资源释放得到，不必落盘即可找图。', {
    category: '图色',
    example: '后台_加载内存图片(句柄, "btn", 图片字节)'
  }),
  opCommand('后台_取图片尺寸', 'OpGetPicSize', [handleArg(), textArg('图片名', '模板名或文件名；已设全局路径时用相对名。'), outIntArg('宽度', '输出：模板宽（像素）。'), outIntArg('高度', '输出：模板高（像素）。')], 'bool', '取模板图片尺寸（写回两个变量）；用于计算点击偏移。注意：本命令按「全局路径+相对名」解析，绝对路径可能取不到。', { category: '图色' }),
  opCommand('后台_取屏幕数据', 'OpGetScreenData', [handleArg(), ...regionArgs(), outIntArg('成功标记', '输出：1=成功，0=失败。')], 'longLong', '取区域像素数据的裸指针（BGRA 排列；需配合 @ 内联 C++ 自行解析，数据生命周期由运行库管理到下次调用前）。高级命令，常规找图请用 后台_找图/后台_找色。', {
    category: '基础', visibility: 'advanced', returnDescription: '像素数据指针（长整数型）；失败返回 0。'
  }),
  opCommand('后台_取屏幕数据BMP', 'OpGetScreenDataBmp', [handleArg(), ...regionArgs(), outIntArg('数据大小', '输出：BMP 数据字节数。'), outIntArg('成功标记', '输出：1=成功，0=失败。')], 'longLong', '取区域截图的完整 BMP 数据裸指针（含文件头），配合 @ 内联 C++ 使用。高级命令。', {
    category: '基础', visibility: 'advanced', returnDescription: 'BMP 数据指针；失败返回 0。'
  }),
  opCommand('后台_取屏幕帧信息', 'OpGetScreenFrameInfo', [handleArg(), outIntArg('帧号', '输出：当前帧序号。'), outIntArg('时间', '输出：帧时间戳。')], 'void', '查询绑定画面的帧序号与时间戳（判断画面是否在刷新/卡死）。', { category: '诊断', visibility: 'advanced' }),
  opCommand('后台_匹配图片名', 'OpMatchPicName', [handleArg(), textArg('图片名', '要匹配的模板名或通配名。')], 'wideString', '查询缓存中与名称匹配的模板列表（排查模板是否加载成功）。', { category: '诊断', visibility: 'advanced' })
];

export {
  BASIC_COMMANDS,
  ALGORITHM_COMMANDS,
  WINDOW_COMMANDS,
  BIND_COMMANDS,
  MOUSE_COMMANDS,
  KEYPAD_COMMANDS,
  IMAGE_COMMANDS
};
