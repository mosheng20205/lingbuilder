import type {
  LingBuilderModuleManifest,
  ModuleBindingValueType,
  ModuleCommandBinding,
  ModuleCommandContribution
} from './types';

export const OPENCV_MODULE_ID = 'lingbuilder.opencv';
export const OPENCV_SDK_MODULE_ID = 'lingbuilder.opencv.sdk';
export const OPENCV_VERSION = '4.14.0';

interface OpenCvCommandSpec {
  name: string;
  parameters?: Array<{ name: string; type: ModuleBindingValueType; description?: string }>;
  returnType: ModuleBindingValueType;
  description: string;
  returnDescription?: string;
  example?: string;
  visibility?: 'default' | 'advanced' | 'internal';
}

const RETURN_LABELS: Record<ModuleBindingValueType, string> = {
  void: '空',
  int: '整数型',
  longLong: '长整数型',
  double: '双精度小数型',
  bool: '逻辑型',
  wideString: '文本型',
  utf8String: '文本型',
  controlRef: '控件引用',
  handler: '处理器',
  lingValue: 'LingCpp 任意值',
  handle: '长整数型',
  bytes: '字节集',
  array: '数组',
  arrayElement: '数组成员',
  raw: '原生类型'
};

const p = (name: string, type: ModuleBindingValueType, description?: string) => ({ name, type, description });

const COMMANDS: OpenCvCommandSpec[] = [
  { name: 'OpenCV_取版本', returnType: 'wideString', description: '返回当前 Bridge 使用的 OpenCV 与 Bridge ABI 版本。', example: 'OpenCV_取版本()' },
  { name: 'OpenCV_加载图像', parameters: [p('路径', 'wideString', '支持中文路径的本地图像文件。'), p('读取模式', 'wideString', '彩色、灰度或原样。')], returnType: 'handle', description: '加载图像并返回受管图像句柄。', returnDescription: '成功返回 OpenCV图像句柄，失败返回 0。', example: 'OpenCV_加载图像("背景.png", "彩色")' },
  { name: 'OpenCV_保存图像', parameters: [p('图像', 'handle'), p('路径', 'wideString'), p('质量', 'int', '0～100；JPEG 使用质量，PNG 使用压缩级别映射。')], returnType: 'bool', description: '按目标扩展名保存图像。', example: 'OpenCV_保存图像(图像, "输出.png", 95)' },
  { name: 'OpenCV_克隆图像', parameters: [p('图像', 'handle')], returnType: 'handle', description: '深复制图像并返回新句柄。' },
  { name: 'OpenCV_释放图像', parameters: [p('图像', 'handle')], returnType: 'bool', description: '释放一个受管图像句柄。' },
  { name: 'OpenCV_释放全部', returnType: 'void', description: '释放当前进程中全部 OpenCV 图像与结果句柄。' },
  { name: 'OpenCV_取宽度', parameters: [p('图像', 'handle')], returnType: 'int', description: '返回图像像素宽度。' },
  { name: 'OpenCV_取高度', parameters: [p('图像', 'handle')], returnType: 'int', description: '返回图像像素高度。' },
  { name: 'OpenCV_取通道数', parameters: [p('图像', 'handle')], returnType: 'int', description: '返回图像通道数。' },
  { name: 'OpenCV_取错误', returnType: 'wideString', description: '读取当前线程最近一次 OpenCV 操作的中文错误。' },
  { name: 'OpenCV_灰度化', parameters: [p('图像', 'handle')], returnType: 'handle', description: '转换为灰度图并返回新句柄。' },
  { name: 'OpenCV_缩放', parameters: [p('图像', 'handle'), p('宽度', 'int'), p('高度', 'int')], returnType: 'handle', description: '使用高质量插值缩放图像并返回新句柄。' },
  { name: 'OpenCV_裁剪', parameters: [p('图像', 'handle'), p('横坐标', 'int'), p('纵坐标', 'int'), p('宽度', 'int'), p('高度', 'int')], returnType: 'handle', description: '裁剪图像区域并返回新句柄。' },
  { name: 'OpenCV_高斯模糊', parameters: [p('图像', 'handle'), p('卷积核', 'int', '1～31 的正奇数。'), p('Sigma', 'double')], returnType: 'handle', description: '执行高斯模糊并返回新句柄。' },
  { name: 'OpenCV_二值化', parameters: [p('图像', 'handle'), p('阈值', 'double'), p('模式', 'wideString', '二值、反二值、大津或大津反向。')], returnType: 'handle', description: '灰度化后执行固定或大津二值化。' },
  { name: 'OpenCV_自适应二值化', parameters: [p('图像', 'handle'), p('块大小', 'int', '3～99 的正奇数。'), p('常数', 'double'), p('反向', 'bool')], returnType: 'handle', description: '执行高斯自适应二值化。' },
  { name: 'OpenCV_Canny边缘', parameters: [p('图像', 'handle'), p('低阈值', 'double'), p('高阈值', 'double')], returnType: 'handle', description: '灰度化后执行 Canny 边缘检测。' },
  { name: 'OpenCV_形态学', parameters: [p('图像', 'handle'), p('操作', 'wideString', '腐蚀、膨胀、开运算、闭运算或梯度。'), p('卷积核', 'int'), p('次数', 'int')], returnType: 'handle', description: '执行形态学操作并返回新句柄。' },
  { name: 'OpenCV_模板匹配', parameters: [p('图像', 'handle'), p('模板', 'handle'), p('方法', 'wideString', '平方差、相关或相关系数。'), p('最低分数', 'double'), p('最大结果数', 'int')], returnType: 'handle', description: '执行模板匹配和重叠抑制，返回受管分析结果。', returnDescription: '成功返回 OpenCV结果句柄；没有候选时仍返回有效句柄。' },
  { name: 'OpenCV_查找轮廓', parameters: [p('图像', 'handle'), p('最小面积', 'double'), p('最大面积', 'double', '0 表示不限制。'), p('最大结果数', 'int')], returnType: 'handle', description: '查找外部轮廓并按面积排序返回矩形候选。' },
  { name: 'OpenCV_分析缺口', parameters: [p('背景图像', 'handle'), p('滑块图像', 'handle', '传 0 时只使用轮廓模式。'), p('候选数量', 'int', '1～8。'), p('配置JSON', 'wideString', '空文本或 {} 使用默认配置。')], returnType: 'handle', description: '使用模板边缘与轮廓的确定性规则分析单缺口或双缺口候选。', returnDescription: '成功返回 OpenCV结果句柄；未发现候选时结果数量为 0。', example: 'OpenCV_分析缺口(背景图, 0, 2, "{}")' },
  { name: 'OpenCV结果_取类型', parameters: [p('结果', 'handle')], returnType: 'wideString', description: '返回模板匹配、轮廓或缺口。' },
  { name: 'OpenCV结果_取数量', parameters: [p('结果', 'handle')], returnType: 'int', description: '返回候选项数量。' },
  { name: 'OpenCV结果_取横坐标', parameters: [p('结果', 'handle'), p('索引', 'int')], returnType: 'int', description: '返回候选矩形左上角横坐标。' },
  { name: 'OpenCV结果_取纵坐标', parameters: [p('结果', 'handle'), p('索引', 'int')], returnType: 'int', description: '返回候选矩形左上角纵坐标。' },
  { name: 'OpenCV结果_取宽度', parameters: [p('结果', 'handle'), p('索引', 'int')], returnType: 'int', description: '返回候选矩形宽度。' },
  { name: 'OpenCV结果_取高度', parameters: [p('结果', 'handle'), p('索引', 'int')], returnType: 'int', description: '返回候选矩形高度。' },
  { name: 'OpenCV结果_取中心横坐标', parameters: [p('结果', 'handle'), p('索引', 'int')], returnType: 'int', description: '返回候选中心横坐标。' },
  { name: 'OpenCV结果_取中心纵坐标', parameters: [p('结果', 'handle'), p('索引', 'int')], returnType: 'int', description: '返回候选中心纵坐标。' },
  { name: 'OpenCV结果_取置信度', parameters: [p('结果', 'handle'), p('索引', 'int')], returnType: 'double', description: '返回 0～1 的候选置信度。' },
  { name: 'OpenCV结果_取JSON', parameters: [p('结果', 'handle')], returnType: 'wideString', description: '返回 schemaVersion 1 的 UTF-16 JSON 结果。' },
  { name: 'OpenCV结果_保存标注图', parameters: [p('结果', 'handle'), p('路径', 'wideString'), p('质量', 'int')], returnType: 'bool', description: '保存带候选矩形和置信度标注的调试图。' },
  { name: 'OpenCV结果_释放', parameters: [p('结果', 'handle')], returnType: 'bool', description: '释放一个受管分析结果句柄。' }
];

function contribution(spec: OpenCvCommandSpec): ModuleCommandContribution {
  const parameters = spec.parameters || [];
  const placeholders = parameters.map((parameter, index) => {
    if (parameter.type === 'wideString' || parameter.type === 'utf8String') return `"$${index + 1}"`;
    if (parameter.type === 'bool') return '假';
    return '0';
  });
  return {
    name: spec.name,
    signature: `${spec.name}(${parameters.map(parameter => parameter.name).join(', ')})`,
    description: spec.description,
    insertText: `${spec.name}(${placeholders.join(', ')})`,
    returnType: RETURN_LABELS[spec.returnType],
    returnDescription: spec.returnDescription,
    visibility: spec.visibility
  };
}

function binding(spec: OpenCvCommandSpec): ModuleCommandBinding {
  return {
    command: spec.name,
    runtimeName: spec.name,
    parameters: spec.parameters || [],
    returnType: spec.returnType,
    targetIds: ['windows-msvc-x64'],
    encoding: (spec.parameters || []).some(parameter => parameter.type === 'wideString') || spec.returnType === 'wideString'
      ? 'wide'
      : undefined,
    example: spec.example
  };
}

export const OPENCV_MODULE: LingBuilderModuleManifest = {
  schemaVersion: 2,
  id: OPENCV_MODULE_ID,
  name: 'OpenCV 图像处理模块',
  version: '1.0.0',
  category: '图像',
  description: '基于 OpenCV 4.14.0 的 x64 本地图像处理、模板匹配、轮廓分析和单/双缺口候选分析模块。',
  author: 'LingBuilder',
  license: 'Apache-2.0',
  tags: ['OpenCV', '图像处理', '模板匹配', '轮廓', '缺口分析', 'x64'],
  minLingBuilderVersion: '0.2.7',
  contributes: {
    commands: COMMANDS.map(contribution),
    types: [
      { name: 'OpenCV图像句柄', description: '由 OpenCV Bridge 管理的图像对象句柄，必须显式释放。', cppType: 'long long' },
      { name: 'OpenCV结果句柄', description: '由 OpenCV Bridge 管理的分析结果句柄，必须显式释放。', cppType: 'long long' }
    ],
    snippets: [{
      label: 'OpenCV缺口分析示例',
      insertText: '局部 OpenCV图像句柄 背景图 = OpenCV_加载图像("背景.png", "彩色")\n局部 OpenCV结果句柄 结果 = OpenCV_分析缺口(背景图, 0, 2, "{}")\n调试输出(OpenCV结果_取JSON(结果))\nOpenCV结果_释放(结果)\nOpenCV_释放图像(背景图)',
      description: '加载背景图并执行双候选缺口分析。'
    }],
    docs: [{ title: 'OpenCV 模块中文说明', path: 'docs/modules/opencv/README.md' }],
    examples: [{
      title: 'OpenCV 图像处理与单/双缺口完整示例',
      path: 'docs/modules/opencv/examples/OpenCV完整示例.lcpp',
      description: '演示截图保存、中文路径加载、预处理、单/双候选读取、标注图保存和句柄释放。'
    }]
  },
  targets: [{
    id: 'windows-msvc-x64',
    platform: 'windows',
    arch: 'x64',
    toolchain: 'msvc',
    defines: ['LINGBUILDER_OPENCV_MODULE']
  }],
  bindings: { commands: COMMANDS.map(binding) }
};

export const OPENCV_COMMAND_NAMES = COMMANDS.map(command => command.name);
