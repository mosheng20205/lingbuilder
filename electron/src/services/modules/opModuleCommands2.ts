import type { StandardCommandSpec } from './standardLibraryModules';
import type { ModuleCommandBindingParameter, ModuleCommandValueType } from './types';

/**
 * OP 后台图色模块命令目录（下半部）：OpenCV、YOLO 检测、点阵字库识字、内存读写。
 * 约定与 opModuleCommands.ts 相同；两文件合计 213 条。
 */
type OpParameter = ModuleCommandBindingParameter & { type: ModuleCommandValueType; description: string };

type OpCommandOptions = Pick<StandardCommandSpec, 'category' | 'example' | 'returnDescription' | 'visibility'>;

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

const handleArg = (): OpParameter => ({ name: '句柄', type: 'OP句柄', description: '后台_创建 返回的 OP 引擎句柄。' });
const hwndArg = (): OpParameter => ({ name: '窗口句柄', type: 'longLong', description: '目标进程的窗口句柄；内存读写按该窗口所属进程执行。' });
const intArg = (name: string, description: string): OpParameter => ({ name, type: 'int', description });
const textArg = (name: string, description: string): OpParameter => ({ name, type: 'wideString', description });
const outIntArg = (name: string, description: string): OpParameter => ({ name, type: 'int', description, byRef: true });
const addressArg = (): OpParameter => textArg('地址', '十六进制地址文本，支持加法偏移表达式（如 "140001000" 或 "140001000+20"）。');
const srcDstArgs = (): OpParameter[] => [
  textArg('源文件', '输入图片路径。'),
  textArg('目标文件', '输出图片路径（目录必须已存在）。')
];
const cvRegionArgs = (): OpParameter[] => [
  intArg('区域横坐标', '搜索区域左上角横坐标（绑定窗口客户区坐标）。'),
  intArg('区域纵坐标', '搜索区域左上角纵坐标。'),
  intArg('区域宽度', '搜索区域宽（像素）。'),
  intArg('区域高度', '搜索区域高（像素）。')
];

// =====================================================================
// OpenCV（35）
// =====================================================================
const CV_COMMANDS: StandardCommandSpec[] = [
  opCommand('后台_CV加载模板', 'OpCvLoadTemplate', [handleArg(), textArg('模板名', '模板在 CV 库中的名字（匹配命令按名引用）。'), textArg('文件路径', '模板图片路径。')], 'bool', '把图片注册为 OpenCV 模板库成员；CV 匹配命令都按模板名工作。', { category: 'OpenCV' }),
  opCommand('后台_CV加载掩码模板', 'OpCvLoadMaskedTemplate', [handleArg(), textArg('模板名', '模板名。'), textArg('模板路径', '模板图片路径。'), textArg('掩码路径', '掩码图片路径（白色=参与匹配，黑色=忽略），遮住干扰区域。')], 'bool', '加载带掩码的模板：掩码黑色区域不参与匹配，专治背景干扰、半透明特效。', { category: 'OpenCV' }),
  opCommand('后台_CV移除模板', 'OpCvRemoveTemplate', [handleArg(), textArg('模板名', '要移除的模板名。')], 'bool', '从 CV 模板库移除指定模板。', { category: 'OpenCV' }),
  opCommand('后台_CV移除全部模板', 'OpCvRemoveAllTemplates', [handleArg()], 'bool', '清空 CV 模板库。', { category: 'OpenCV' }),
  opCommand('后台_CV存在模板', 'OpCvHasTemplate', [handleArg(), textArg('模板名', '模板名。')], 'bool', '判断模板是否已在 CV 库中（真=存在）。', { category: 'OpenCV' }),
  opCommand('后台_CV取模板数量', 'OpCvGetTemplateCount', [handleArg()], 'int', '返回 CV 模板库中的模板总数。', { category: 'OpenCV' }),
  opCommand('后台_CV取全部模板名', 'OpCvGetAllTemplateNames', [handleArg()], 'wideString', '返回 CV 模板库全部模板名列表。', { category: 'OpenCV' }),
  opCommand('后台_CV取OpenCV版本', 'OpCvGetOpenCvVersion', [handleArg()], 'wideString', '返回随包 OpenCV 版本文本。', { category: '诊断' }),
  opCommand('后台_CV加载模板列表', 'OpCvLoadTemplateList', [handleArg(), textArg('模板列表', '批量加载描述（名称与路径成对，分隔符规则见上游 Wiki「OpenCV」页）。')], 'bool', '按列表一次性批量加载多个 CV 模板。', { category: 'OpenCV' }),
  opCommand('后台_CV转灰度', 'OpCvToGray', [handleArg(), ...srcDstArgs()], 'bool', '图片预处理：转灰度图。', { category: 'OpenCV' }),
  opCommand('后台_CV转二值', 'OpCvToBinary', [handleArg(), ...srcDstArgs()], 'bool', '图片预处理：转黑白二值图（自动阈值）。', { category: 'OpenCV' }),
  opCommand('后台_CV转边缘', 'OpCvToEdge', [handleArg(), ...srcDstArgs()], 'bool', '图片预处理：提取边缘（Canny）。', { category: 'OpenCV' }),
  opCommand('后台_CV转轮廓', 'OpCvToOutline', [handleArg(), ...srcDstArgs()], 'bool', '图片预处理：提取物体轮廓线。', { category: 'OpenCV' }),
  opCommand('后台_CV去噪', 'OpCvDenoise', [handleArg(), ...srcDstArgs()], 'bool', '图片预处理：去噪点。', { category: 'OpenCV' }),
  opCommand('后台_CV直方图均衡', 'OpCvEqualize', [handleArg(), ...srcDstArgs()], 'bool', '图片预处理：直方图均衡，增强整体对比度。', { category: 'OpenCV' }),
  opCommand('后台_CV限制对比度均衡', 'OpCvCLAHE', [handleArg(), ...srcDstArgs(), { name: '裁剪限制', type: 'double', description: '对比度裁剪限制，常用 2.0～4.0。' }, intArg('网格尺寸', '分块网格边长，常用 8。')], 'bool', '图片预处理：限制对比度自适应直方图均衡（CLAHE），光照不均场景的标配。', { category: 'OpenCV' }),
  opCommand('后台_CV模糊', 'OpCvBlur', [handleArg(), ...srcDstArgs(), textArg('模式', '模糊核形态（如 "mean"、"gauss"、"median"）。'), intArg('核尺寸', '模糊核边长（奇数）。')], 'bool', '图片预处理：均值/高斯/中值模糊。', { category: 'OpenCV' }),
  opCommand('后台_CV锐化', 'OpCvSharpen', [handleArg(), ...srcDstArgs(), { name: '强度', type: 'double', description: '锐化强度。' }], 'bool', '图片预处理：锐化增强细节。', { category: 'OpenCV' }),
  opCommand('后台_CV裁有效区域', 'OpCvCropValid', [handleArg(), ...srcDstArgs()], 'bool', '图片预处理：自动裁掉四周空白，保留有效内容。', { category: 'OpenCV' }),
  opCommand('后台_CV连通域分析', 'OpCvConnectedComponents', [handleArg(), textArg('源文件', '输入图片路径（建议先二值化）。'), { name: '最小面积', type: 'double', description: '连通域最小面积，小于该值的丢弃。' }], 'wideString', '对二值图做连通域分析，返回各连通域信息（数量与包围盒），数格子/数物件用。', { category: 'OpenCV', returnDescription: '连通域信息文本。' }),
  opCommand('后台_CV找轮廓', 'OpCvFindContours', [handleArg(), textArg('源文件', '输入图片路径。'), { name: '最小面积', type: 'double', description: '轮廓最小面积。' }], 'wideString', '提取图片中的轮廓集合与包围盒信息。', { category: 'OpenCV', returnDescription: '轮廓信息文本。' }),
  opCommand('后台_CV预处理管线', 'OpCvPreprocessPipeline', [handleArg(), textArg('源文件', '输入图片路径。'), textArg('目标文件', '输出图片路径。'), textArg('管线', '按顺序拼接的预处理步骤描述（步骤语法见上游 Wiki）。')], 'bool', '一条命令按顺序执行多个预处理步骤（如 灰度→二值→去噪），免去多张中间图。', { category: 'OpenCV' }),
  opCommand('后台_CV裁剪', 'OpCvCrop', [handleArg(), textArg('源文件', '输入图片路径。'), intArg('横坐标', '裁剪区域左上角横坐标。'), intArg('纵坐标', '裁剪区域左上角纵坐标。'), intArg('宽度', '裁剪宽。'), intArg('高度', '裁剪高。'), textArg('目标文件', '输出图片路径。')], 'bool', '裁剪图片指定区域另存。', { category: 'OpenCV' }),
  opCommand('后台_CV缩放', 'OpCvResize', [handleArg(), textArg('源文件', '输入图片路径。'), intArg('宽度', '目标宽。'), intArg('高度', '目标高。'), textArg('目标文件', '输出图片路径。')], 'bool', '把图片缩放到指定尺寸另存。', { category: 'OpenCV' }),
  opCommand('后台_CV阈值化', 'OpCvThreshold', [handleArg(), textArg('源文件', '输入图片路径。'), textArg('目标文件', '输出图片路径。'), { name: '阈值', type: 'double', description: '二值化阈值（0～255）。' }, { name: '最大值', type: 'double', description: '超过阈值时写入的值。' }, textArg('模式', '阈值化模式（如 "binary"、"otsu"）。')], 'bool', '按指定阈值做二值化（支持 Otsu 自动阈值等模式）。', { category: 'OpenCV' }),
  opCommand('后台_CV通道范围', 'OpCvInRange', [handleArg(), textArg('源文件', '输入图片路径。'), textArg('目标文件', '输出图片路径。'), textArg('颜色空间', '颜色空间（如 "bgr"、"hsv"）。'), textArg('下界', '各通道下限（如 "0,100,100"）。'), textArg('上界', '各通道上限。')], 'bool', '按颜色区间过滤生成掩码图（HSV 下抓特定颜色物体的标准做法）。', { category: 'OpenCV' }),
  opCommand('后台_CV形态学', 'OpCvMorphology', [handleArg(), textArg('源文件', '输入图片路径。'), textArg('目标文件', '输出图片路径。'), textArg('模式', '"erode"=腐蚀 / "dilate"=膨胀 / "open"=开 / "close"=闭。'), intArg('核尺寸', '结构元边长（奇数）。'), intArg('迭代次数', '执行次数。')], 'bool', '形态学处理：腐蚀/膨胀/开/闭运算，去掉噪点或填补断裂。', { category: 'OpenCV' }),
  opCommand('后台_CV细化', 'OpCvThin', [handleArg(), textArg('源文件', '输入图片路径。'), textArg('目标文件', '输出图片路径。'), textArg('模式', '细化算法模式。')], 'bool', '把二值图中的笔画细化成单像素线（验证码、点阵预处理）。', { category: 'OpenCV' }),
  opCommand('后台_CV模板匹配', 'OpCvMatchTemplate', [
    handleArg(), ...cvRegionArgs(),
    textArg('模板名', 'CV 模板库中的模板名。'),
    { name: '阈值', type: 'double', description: '匹配置信度阈值 0～1。' },
    intArg('方向', '多结果时的排序方向。'),
    intArg('去重模式', '重叠结果的去重策略（strip_mode）。'),
    intArg('匹配方法', 'OpenCV 匹配方法编号（0=TM_CCORR_NORMED 系列等，见上游 Wiki）。'),
    intArg('颜色模式', '0=彩色，1=灰度。')
  ], 'wideString', 'OpenCV 亚像素级模板匹配，返回命中结果文本（含位置与得分）；比传统找图更抗噪、支持掩码模板。', {
    category: 'OpenCV',
    returnDescription: '命中结果文本；未命中返回空文本。'
  }),
  opCommand('后台_CV缩放模板匹配', 'OpCvMatchTemplateScale', [
    handleArg(), ...cvRegionArgs(),
    textArg('模板名', '模板名。'),
    textArg('缩放集', '候选缩放比例列表（如 "0.8,1.0,1.2"）。'),
    { name: '阈值', type: 'double', description: '匹配置信度阈值。' },
    intArg('匹配方法', 'OpenCV 匹配方法编号。'),
    intArg('颜色模式', '0=彩色，1=灰度。')
  ], 'wideString', '多尺度模板匹配：按缩放集逐档尝试，专治目标忽大忽小（远近景、缩放 UI）。', {
    category: 'OpenCV',
    returnDescription: '命中结果文本（含缩放档）；未命中返回空文本。'
  }),
  opCommand('后台_CV任一模板匹配', 'OpCvMatchAnyTemplate', [
    handleArg(), ...cvRegionArgs(),
    textArg('模板名集', '多个模板名，分隔符规则见上游 Wiki。'),
    { name: '阈值', type: 'double', description: '匹配置信度阈值。' },
    intArg('方向', '排序方向。'),
    intArg('去重模式', '去重策略。'),
    intArg('匹配方法', '匹配方法编号。'),
    intArg('颜色模式', '0=彩色，1=灰度。')
  ], 'wideString', '多模板中找任意一个命中的结果（返回命中了哪个模板）。', { category: 'OpenCV', returnDescription: '命中结果文本。' }),
  opCommand('后台_CV全部模板匹配', 'OpCvMatchAllTemplates', [
    handleArg(), ...cvRegionArgs(),
    textArg('模板名集', '多个模板名。'),
    { name: '阈值', type: 'double', description: '匹配置信度阈值。' },
    intArg('方向', '排序方向。'),
    intArg('去重模式', '去重策略。'),
    intArg('匹配方法', '匹配方法编号。'),
    intArg('颜色模式', '0=彩色，1=灰度。')
  ], 'wideString', '对模板集中每一个模板都做匹配并返回全部结果（全屏元素巡检）。', { category: 'OpenCV', returnDescription: '命中结果文本。' }),
  opCommand('后台_CV特征点匹配', 'OpCvFeatureMatchTemplate', [
    handleArg(), ...cvRegionArgs(),
    textArg('模板名', '模板名。'),
    { name: '阈值', type: 'double', description: '特征匹配置信度阈值。' }
  ], 'wideString', '基于特征点（SIFT/ORB 系）的匹配：目标发生旋转、缩放、部分遮挡仍可命中，是抗形变场景的终极手段。', { category: 'OpenCV', returnDescription: '命中结果文本。' }),
  opCommand('后台_CV边缘匹配', 'OpCvEdgeMatchTemplate', [handleArg(), ...cvRegionArgs(), textArg('模板名', '模板名。'), { name: '阈值', type: 'double', description: '匹配置信度阈值。' }], 'wideString', '基于边缘特征的模板匹配：对光照/颜色变化不敏感，只看形状轮廓。', { category: 'OpenCV', returnDescription: '命中结果文本。' }),
  opCommand('后台_CV形状匹配', 'OpCvShapeMatchTemplate', [handleArg(), ...cvRegionArgs(), textArg('模板名', '模板名。'), { name: '阈值', type: 'double', description: '匹配置信度阈值。' }], 'wideString', '基于形状轮廓的模板匹配（Shape Matching）。', { category: 'OpenCV', returnDescription: '命中结果文本。' })
];

// =====================================================================
// YOLO 检测（3）
// =====================================================================
const YOLO_COMMANDS: StandardCommandSpec[] = [
  opCommand('后台_置YOLO引擎', 'OpSetYoloEngine', [handleArg(), textArg('引擎路径', 'YOLO 推理服务的启动目录（上游 op_yolo_engine.py 所在目录）。'), textArg('服务DLL', '预留的引擎 DLL 名（HTTP 模式留空）。'), textArg('启动参数', '引擎启动参数（如端口、模型路径）。')], 'bool', '配置 YOLO 目标检测引擎（外部 Python 服务，启动方法见随包文档；不使用 YOLO 可完全忽略本组命令）。', { category: '检测' }),
  opCommand('后台_YOLO检测', 'OpYoloDetect', [handleArg(), intArg('左上横坐标', '检测区域左上角横坐标。'), intArg('左上纵坐标', '检测区域左上角纵坐标。'), intArg('右下横坐标', '检测区域右下角横坐标（开区间）。'), intArg('右下纵坐标', '检测区域右下角纵坐标（开区间）。'), { name: '置信度', type: 'double', description: '置信度阈值 0～1，低于该值的结果丢弃。' }, { name: '交并比', type: 'double', description: 'NMS 去重的 IoU 阈值，常用 0.45。' }], 'wideString', '对绑定画面指定区域做 YOLO 目标检测，返回全部检出目标（类别、坐标、置信度）。', {
    category: '检测',
    returnDescription: '检出目标列表文本；无检出返回空文本。'
  }),
  opCommand('后台_YOLO检测文件', 'OpYoloDetectFromFile', [handleArg(), textArg('文件名', '待检测的图片文件路径。'), { name: '置信度', type: 'double', description: '置信度阈值。' }, { name: '交并比', type: 'double', description: 'NMS 的 IoU 阈值。' }], 'wideString', '对图片文件做 YOLO 目标检测（不依赖当前绑定）。', { category: '检测', returnDescription: '检出目标列表文本。' })
];

// =====================================================================
// 点阵字库识字（35）
// =====================================================================
const OCR_COMMANDS: StandardCommandSpec[] = [
  opCommand('后台_加载字库', 'OpSetDict', [handleArg(), intArg('字库序号', '字库槽位（0～9，可同时驻留多套）。'), textArg('文件名', '字库文件路径；兼容大漠文本点阵字库格式。')], 'bool', '从文件加载点阵字库到指定槽位。加载后用 后台_切换字库 选用；大漠用户现成的 dm.txt 字库可直接使用。', {
    category: '字库识字',
    example: '后台_加载字库(句柄, 0, "fonts/游戏字库.txt")'
  }),
  opCommand('后台_取字库条目', 'OpGetDict', [handleArg(), intArg('字库序号', '字库槽位。'), intArg('字体索引', '字库内条目序号，从 0 起。')], 'wideString', '读取字库内指定条目的原始描述（调试字库用）。', { category: '字库识字', visibility: 'advanced' }),
  opCommand('后台_加载内存字库', 'OpSetMemDict', [handleArg(), intArg('字库序号', '字库槽位。'), { name: '字库数据', type: 'bytes', description: '字库文件内容字节集（可从网络下载或资源释放得到）。' }], 'bool', '从字节集加载点阵字库——字库不必落盘。', { category: '字库识字' }),
  opCommand('后台_切换字库', 'OpUseDict', [handleArg(), intArg('字库序号', '要启用的字库槽位（0～9）。')], 'bool', '切换当前识字/找字使用的字库；全部字库命令共用这个"当前字库"概念。', { category: '字库识字' }),
  opCommand('后台_追加字库', 'OpAddDict', [handleArg(), intArg('字库序号', '字库槽位。'), textArg('字库信息', '单条字库条目描述（"字$点阵数据" 形态）。')], 'bool', '向字库追加/更新一个字的点阵描述（游戏中遇到新字随时补录）。', { category: '字库识字' }),
  opCommand('后台_保存字库', 'OpSaveDict', [handleArg(), intArg('字库序号', '字库槽位。'), textArg('文件名', '保存路径。')], 'bool', '把字库（含运行期追加的条目）保存为文件。', { category: '字库识字' }),
  opCommand('后台_清空字库', 'OpClearDict', [handleArg(), intArg('字库序号', '字库槽位。')], 'bool', '清空指定槽位的字库内容。', { category: '字库识字' }),
  opCommand('后台_取字库条数', 'OpGetDictCount', [handleArg(), intArg('字库序号', '字库槽位。')], 'int', '返回指定字库的条目数量（判断字库是否加载成功的轻量探针）。', { category: '字库识字' }),
  opCommand('后台_取当前字库序号', 'OpGetNowDict', [handleArg()], 'int', '返回当前启用的字库槽位号。', { category: '字库识字' }),
  opCommand('后台_置二值化预处理', 'OpSetBinaryPreprocess', [handleArg(), intArg('模式', '预处理模式。'), intArg('孤点阈值', '孤立点判定阈值。'), intArg('最小连通面积', '连通域最小面积。'), intArg('桥接间距', '断裂笔画桥接距离。')], 'bool', '配置识字前的二值化预处理（抗噪、断笔修复），复杂背景字库识别的调参入口。', { category: '字库识字' }),
  opCommand('后台_取二值化预处理', 'OpGetBinaryPreprocess', [handleArg(), outIntArg('模式', '输出：当前模式。'), outIntArg('孤点阈值', '输出：孤点阈值。'), outIntArg('最小连通面积', '输出：最小连通面积。'), outIntArg('桥接间距', '输出：桥接间距。')], 'bool', '读取当前二值化预处理配置（写回四个变量）。', { category: '字库识字' }),
  opCommand('后台_取词', 'OpFetchWord', [handleArg(), intArg('左上横坐标', '区域左上角横坐标。'), intArg('左上纵坐标', '区域左上角纵坐标。'), intArg('右下横坐标', '区域右下角横坐标（开区间）。'), intArg('右下纵坐标', '区域右下角纵坐标（开区间）。'), textArg('颜色', '文字颜色描述（RRGGBB，支持 "颜色-偏差"）。'), textArg('词', '要抓取的目标词。')], 'wideString', '在区域内抓取指定词的精确位置信息（做"点击某个文字按钮"的标准前置）。', { category: '字库识字', returnDescription: '词的位置信息文本。' }),
  opCommand('后台_取词相似', 'OpFetchWordEx', [handleArg(), intArg('左上横坐标', '区域左上角横坐标。'), intArg('左上纵坐标', '区域左上角纵坐标。'), intArg('右下横坐标', '区域右下角横坐标（开区间）。'), intArg('右下纵坐标', '区域右下角纵坐标（开区间）。'), textArg('颜色', '文字颜色描述。'), { name: '相似度', type: 'double', description: '点阵匹配相似度 0～1。' }, textArg('词', '要抓取的目标词。')], 'wideString', '带相似度的取词（字形轻微抗锯齿/模糊时使用）。', { category: '字库识字', returnDescription: '词的位置信息文本。' }),
  opCommand('后台_提取词框', 'OpExtractWordRects', [handleArg(), intArg('左上横坐标', '区域左上角横坐标。'), intArg('左上纵坐标', '区域左上角纵坐标。'), intArg('右下横坐标', '区域右下角横坐标（开区间）。'), intArg('右下纵坐标', '区域右下角纵坐标（开区间）。'), textArg('颜色', '文字颜色描述。'), { name: '相似度', type: 'double', description: '相似度 0～1。' }, intArg('最小词高', '词块最小高度（像素），过滤噪声线。')], 'wideString', '不指定词内容，直接把区域内符合颜色特征的文字块切出来（返回每块包围盒），做字库采集/切词工具用。', { category: '字库识字', returnDescription: '词框列表文本。' }),
  opCommand('后台_提取词框相似', 'OpExtractWordRectsEx', [handleArg(), intArg('左上横坐标', '区域左上角横坐标。'), intArg('左上纵坐标', '区域左上角纵坐标。'), intArg('右下横坐标', '区域右下角横坐标（开区间）。'), intArg('右下纵坐标', '区域右下角纵坐标（开区间）。'), textArg('颜色', '文字颜色描述。'), { name: '相似度', type: 'double', description: '相似度 0～1。' }, intArg('最小词宽', '词块最小宽度。'), intArg('最小词高', '词块最小高度。'), intArg('边距', '词框外扩边距（像素）。')], 'wideString', '增强版切词：可分别控制最小宽高与外扩边距。', { category: '字库识字', returnDescription: '词框列表文本。' }),
  opCommand('后台_取词组', 'OpFetchWords', [handleArg(), intArg('左上横坐标', '区域左上角横坐标。'), intArg('左上纵坐标', '区域左上角纵坐标。'), intArg('右下横坐标', '区域右下角横坐标（开区间）。'), intArg('右下纵坐标', '区域右下角纵坐标（开区间）。'), textArg('颜色', '文字颜色描述。'), { name: '相似度', type: 'double', description: '相似度 0～1。' }, textArg('词集', '要批量抓取的多个词（分隔规则见上游 Wiki）。'), intArg('最小词高', '词块最小高度。')], 'wideString', '一次抓取多个指定词的位置（拿一屏全部菜单项的位置）。', { category: '字库识字', returnDescription: '各词位置信息文本。' }),
  opCommand('后台_取词组相似', 'OpFetchWordsEx', [handleArg(), intArg('左上横坐标', '区域左上角横坐标。'), intArg('左上纵坐标', '区域左上角纵坐标。'), intArg('右下横坐标', '区域右下角横坐标（开区间）。'), intArg('右下纵坐标', '区域右下角纵坐标（开区间）。'), textArg('颜色', '文字颜色描述。'), { name: '相似度', type: 'double', description: '相似度 0～1。' }, textArg('词集', '要批量抓取的多个词。'), intArg('最小词宽', '词块最小宽度。'), intArg('最小词高', '词块最小高度。'), intArg('边距', '词框外扩边距。')], 'wideString', '增强版批量取词（可控宽高与边距）。', { category: '字库识字', returnDescription: '各词位置信息文本。' }),
  opCommand('后台_按框取词组', 'OpFetchWordsByRects', [handleArg(), intArg('左上横坐标', '整体区域左上角横坐标。'), intArg('左上纵坐标', '整体区域左上角纵坐标。'), intArg('右下横坐标', '整体区域右下角横坐标（开区间）。'), intArg('右下纵坐标', '整体区域右下角纵坐标（开区间）。'), textArg('颜色', '文字颜色描述。'), { name: '相似度', type: 'double', description: '相似度 0～1。' }, textArg('词集', '要识别的多个词。'), textArg('矩形集', '每个词所在的候选框列表（来自 后台_提取词框 的结果）。')], 'wideString', '在给定的候选框集合里识别指定词组（先切块再认字的两段式识别，抗干扰强）。', { category: '字库识字', returnDescription: '各词识别结果文本。' }),
  opCommand('后台_二值化预览', 'OpGetBinaryPreview', [handleArg(), intArg('左上横坐标', '区域左上角横坐标。'), intArg('左上纵坐标', '区域左上角纵坐标。'), intArg('右下横坐标', '区域右下角横坐标（开区间）。'), intArg('右下纵坐标', '区域右下角纵坐标（开区间）。'), textArg('颜色', '文字颜色描述。'), { name: '相似度', type: 'double', description: '相似度 0～1。' }, outIntArg('成功标记', '输出：1=成功，0=失败。')], 'wideString', '返回区域按当前颜色/相似度二值化后的预览点阵文本——调字库时的"眼睛"，看引擎实际看到了什么。', { category: '字库识字', returnDescription: '二值化点阵预览文本。' }),
  opCommand('后台_单字预览', 'OpGetWordPreview', [handleArg(), textArg('字库信息', '单条字库条目描述。'), outIntArg('成功标记', '输出：1=成功，0=失败。')], 'wideString', '把单条字库条目的点阵渲染成预览文本（校验字库条目内容）。', { category: '字库识字', visibility: 'advanced', returnDescription: '点阵预览文本。' }),
  opCommand('后台_校验字库', 'OpCheckWordDict', [handleArg(), textArg('字库信息', '要校验的字库条目。'), outIntArg('结果标记', '输出：1=合法，0=非法。')], 'wideString', '校验字库条目格式是否合法并返回诊断信息。', { category: '字库识字', visibility: 'advanced' }),
  opCommand('后台_规范化字库', 'OpNormalizeWordDict', [handleArg(), textArg('字库信息', '要规范化的字库条目。'), outIntArg('结果标记', '输出：1=成功，0=失败。')], 'wideString', '把字库条目规范化为标准形态（采集工具输出前处理）。', { category: '字库识字', visibility: 'advanced' }),
  opCommand('后台_字库改名', 'OpRenameWordDict', [handleArg(), textArg('字库信息', '原字库条目。'), textArg('新词', '条目对应的新字符。'), outIntArg('结果标记', '输出：1=成功，0=失败。')], 'wideString', '修改字库条目对应的字符（采错字时改绑）。', { category: '字库识字', visibility: 'advanced' }),
  opCommand('后台_无字库取词', 'OpGetWordsNoDict', [handleArg(), intArg('左上横坐标', '区域左上角横坐标。'), intArg('左上纵坐标', '区域左上角纵坐标。'), intArg('右下横坐标', '区域右下角横坐标（开区间）。'), intArg('右下纵坐标', '区域右下角纵坐标（开区间）。'), textArg('颜色', '文字颜色描述。')], 'wideString', '不加载字库直接切出区域内全部文字块及其点阵描述——配合 后台_追加字库 就地采集新字库。', { category: '字库识字', returnDescription: '文字块与点阵描述文本。' }),
  opCommand('后台_取词结果数量', 'OpGetWordResultCount', [handleArg(), textArg('结果', '取词/识字命令返回的结果文本。')], 'int', '解析取词结果中的条目数量。', { category: '字库识字' }),
  opCommand('后台_取词结果坐标', 'OpGetWordResultPos', [handleArg(), textArg('结果', '取词结果文本。'), intArg('索引', '条目索引，从 0 起。'), outIntArg('横坐标', '输出：该条目横坐标。'), outIntArg('纵坐标', '输出：该条目纵坐标。')], 'bool', '读取取词结果中指定条目的坐标（写回两个变量）。', { category: '字库识字' }),
  opCommand('后台_取词结果文本', 'OpGetWordResultStr', [handleArg(), textArg('结果', '取词结果文本。'), intArg('索引', '条目索引，从 0 起。')], 'wideString', '读取取词结果中指定条目识别出的文字。', { category: '字库识字' }),
  opCommand('后台_识字', 'OpOcr', [handleArg(), intArg('左上横坐标', '区域左上角横坐标。'), intArg('左上纵坐标', '区域左上角纵坐标。'), intArg('右下横坐标', '区域右下角横坐标（开区间）。'), intArg('右下纵坐标', '区域右下角纵坐标（开区间）。'), textArg('颜色', '文字颜色描述（RRGGBB，支持 "颜色-偏差"）。'), { name: '相似度', type: 'double', description: '点阵匹配相似度 0～1。' }], 'wideString', '用当前字库识别区域内文字并返回文本（游戏点阵字体的标准识字入口；自然图片文字请改用 lingbuilder.ocr 模块）。', {
    category: '字库识字',
    example: '后台_识字(句柄, 0, 0, 200, 30, "FFFFFF-000000", 0.9)',
    returnDescription: '识别出的文本；未识别返回空文本。'
  }),
  opCommand('后台_识字带坐标', 'OpOcrEx', [handleArg(), intArg('左上横坐标', '区域左上角横坐标。'), intArg('左上纵坐标', '区域左上角纵坐标。'), intArg('右下横坐标', '区域右下角横坐标（开区间）。'), intArg('右下纵坐标', '区域右下角纵坐标（开区间）。'), textArg('颜色', '文字颜色描述。'), { name: '相似度', type: 'double', description: '相似度 0～1。' }], 'wideString', '识字并返回每段文字的坐标信息（配合 后台_取词结果数量/坐标/文本 三件套解析）。', { category: '字库识字', returnDescription: '文字与坐标信息文本。' }),
  opCommand('后台_找字', 'OpFindStr', [handleArg(), intArg('左上横坐标', '区域左上角横坐标。'), intArg('左上纵坐标', '区域左上角纵坐标。'), intArg('右下横坐标', '区域右下角横坐标（开区间）。'), intArg('右下纵坐标', '区域右下角纵坐标（开区间）。'), textArg('字串集', '要查找的字符串，多个用 "|" 分隔。'), textArg('颜色', '文字颜色描述。'), { name: '相似度', type: 'double', description: '相似度 0～1。' }, outIntArg('结果横坐标', '输出：命中位置横坐标。'), outIntArg('结果纵坐标', '输出：命中位置纵坐标。')], 'bool', '在区域内查找指定文字，命中坐标写回两个变量（找"活动"、"领取"等文字按钮的直接入口）。', { category: '字库识字', returnDescription: '真=找到；坐标写回结果参数。' }),
  opCommand('后台_找字全部', 'OpFindStrEx', [handleArg(), intArg('左上横坐标', '区域左上角横坐标。'), intArg('左上纵坐标', '区域左上角纵坐标。'), intArg('右下横坐标', '区域右下角横坐标（开区间）。'), intArg('右下纵坐标', '区域右下角纵坐标（开区间）。'), textArg('字串集', '要查找的字符串，多个用 "|" 分隔。'), textArg('颜色', '文字颜色描述。'), { name: '相似度', type: 'double', description: '相似度 0～1。' }], 'wideString', '查找全部命中文字及其位置。', { category: '字库识字', returnDescription: '"字串,x,y|..." 文本；未找到返回空文本。' }),
  opCommand('后台_自动识字', 'OpOcrAuto', [handleArg(), intArg('左上横坐标', '区域左上角横坐标。'), intArg('左上纵坐标', '区域左上角纵坐标。'), intArg('右下横坐标', '区域右下角横坐标（开区间）。'), intArg('右下纵坐标', '区域右下角纵坐标（开区间）。'), { name: '相似度', type: 'double', description: '相似度 0～1。' }], 'wideString', '免颜色描述的识字（引擎自动分析前景色）；颜色不固定或懒得取色时用。', { category: '字库识字' }),
  opCommand('后台_文件识字', 'OpOcrFromFile', [handleArg(), textArg('文件名', '图片文件路径。'), textArg('颜色格式', '颜色描述（同 后台_识字 的颜色参数）。'), { name: '相似度', type: 'double', description: '相似度 0～1。' }], 'wideString', '对图片文件做字库识字（不依赖当前绑定；配合 后台_截图 做离线批量识别）。', { category: '字库识字' }),
  opCommand('后台_文件自动识字', 'OpOcrAutoFromFile', [handleArg(), textArg('文件名', '图片文件路径。'), { name: '相似度', type: 'double', description: '相似度 0～1。' }], 'wideString', '对图片文件做免颜色识字。', { category: '字库识字' }),
  opCommand('后台_找直线', 'OpFindLine', [handleArg(), intArg('左上横坐标', '区域左上角横坐标。'), intArg('左上纵坐标', '区域左上角纵坐标。'), intArg('右下横坐标', '区域右下角横坐标（开区间）。'), intArg('右下纵坐标', '区域右下角纵坐标（开区间）。'), textArg('颜色', '直线颜色描述。'), { name: '相似度', type: 'double', description: '相似度 0～1。' }], 'wideString', '在区域内找指定颜色的直线段（小地图寻路、跑道对齐等场景）。', { category: '字库识字', returnDescription: '直线信息文本。' })
];

// =====================================================================
// 内存读写（10）
// =====================================================================
const MEMORY_COMMANDS: StandardCommandSpec[] = [
  opCommand('后台_写内存数据', 'OpWriteData', [handleArg(), hwndArg(), addressArg(), textArg('十六进制数据', '要写入的字节内容，十六进制文本（如 "01020304"）。'), intArg('字节数', '写入字节数。')], 'bool', '向目标进程内存写入原始字节。仅用于调试自有软件；操作第三方游戏内存可能违反其用户协议，风险自负。', { category: '内存' }),
  opCommand('后台_读内存数据', 'OpReadData', [handleArg(), hwndArg(), addressArg(), intArg('字节数', '读取字节数。')], 'wideString', '读取目标进程内存原始字节，返回十六进制文本。', { category: '内存', returnDescription: '十六进制数据文本。' }),
  opCommand('后台_读内存整数', 'OpReadInt', [handleArg(), hwndArg(), addressArg(), intArg('类型', '0=int32，1=int16，2=int8，3=int64，4=uint32，5=uint16，6=uint8。'), { name: '数值', type: 'longLong', description: '输出：读到的整数值。传入一个长整数型变量接收。', byRef: true }], 'bool', '读取目标进程内存中的整数（类型决定宽度与符号解释；写回 数值 变量）。', { category: '内存', returnDescription: '真=读取成功。' }),
  opCommand('后台_写内存整数', 'OpWriteInt', [handleArg(), hwndArg(), addressArg(), intArg('类型', '同 后台_读内存整数 的类型表。'), { name: '数值', type: 'longLong', description: '要写入的整数值。' }], 'bool', '向目标进程内存写入整数。', { category: '内存' }),
  opCommand('后台_读内存单精度', 'OpReadFloat', [handleArg(), hwndArg(), addressArg(), { name: '数值', type: 'float', description: '输出：读到的单精度浮点值。传入一个单精度小数型变量接收。', byRef: true }], 'bool', '读取单精度浮点（血量/坐标等 float 数值常用）。', { category: '内存', returnDescription: '真=读取成功。' }),
  opCommand('后台_写内存单精度', 'OpWriteFloat', [handleArg(), hwndArg(), addressArg(), { name: '数值', type: 'float', description: '要写入的单精度浮点值。' }], 'bool', '写入单精度浮点。', { category: '内存' }),
  opCommand('后台_读内存小数', 'OpReadDouble', [handleArg(), hwndArg(), addressArg(), { name: '数值', type: 'double', description: '输出：读到的双精度浮点值。传入一个双精度小数型变量接收。', byRef: true }], 'bool', '读取双精度浮点。', { category: '内存', returnDescription: '真=读取成功。' }),
  opCommand('后台_写内存小数', 'OpWriteDouble', [handleArg(), hwndArg(), addressArg(), { name: '数值', type: 'double', description: '要写入的双精度浮点值。' }], 'bool', '写入双精度浮点。', { category: '内存' }),
  opCommand('后台_读内存文本', 'OpReadString', [handleArg(), hwndArg(), addressArg(), intArg('编码', '0=ACP/GBK，1=UTF-16，2=UTF-8。'), intArg('长度', '最大字符数；0 表示自动读到结尾。')], 'wideString', '读取目标进程内存中的字符串（按指定编码解释）。', { category: '内存', returnDescription: '读到的文本；失败返回空文本。' }),
  opCommand('后台_写内存文本', 'OpWriteString', [handleArg(), hwndArg(), addressArg(), intArg('编码', '0=ACP/GBK，1=UTF-16，2=UTF-8。'), textArg('内容', '要写入的文本。')], 'bool', '向目标进程内存写入字符串。', { category: '内存' })
];

export {
  CV_COMMANDS,
  YOLO_COMMANDS,
  OCR_COMMANDS,
  MEMORY_COMMANDS
};
