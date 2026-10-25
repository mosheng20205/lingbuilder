import { createStandardModule } from './standardLibraryModuleFactory';
import { LingBuilderModuleManifest } from './types';
import {
  ALGORITHM_COMMANDS,
  BASIC_COMMANDS,
  BIND_COMMANDS,
  IMAGE_COMMANDS,
  KEYPAD_COMMANDS,
  MOUSE_COMMANDS,
  WINDOW_COMMANDS
} from './opModuleCommands';
import { CV_COMMANDS, MEMORY_COMMANDS, OCR_COMMANDS, YOLO_COMMANDS } from './opModuleCommands2';

/** OP 后台图色模块 ID：基于开源 WallBreaker2/op（MIT）C API 的后台绑定与图色能力。 */
export const OP_MODULE_ID = 'lingbuilder.op';

/** 上游钉版版本；升级必须重跑 M0/M3 全套回归并同步 NOTICE.md 与 SHA-256 基线。 */
export const OP_UPSTREAM_VERSION = '0.4.8.3';

/** 随附运行库（third_party/op，op 0.4.8.3）的 SHA-256 基线；详见 third_party/op/NOTICE.md。 */
export const OP_BUNDLED_RUNTIME_SHA256 = {
  x86: '9d5c2ef3590e45ee83dd67cc762d59bbd4c91fa3de98984fc027b5b11761546a',
  x64: '61c19c0b3b04314003581ee88a225be1192a8a820f2806b3ed02ba3dd35c8e5a'
} as const;

const OP_COMMANDS = [
  ...BASIC_COMMANDS,
  ...ALGORITHM_COMMANDS,
  ...WINDOW_COMMANDS,
  ...BIND_COMMANDS,
  ...MOUSE_COMMANDS,
  ...KEYPAD_COMMANDS,
  ...IMAGE_COMMANDS,
  ...CV_COMMANDS,
  ...YOLO_COMMANDS,
  ...OCR_COMMANDS,
  ...MEMORY_COMMANDS
];

const opStandardModule = createStandardModule({
  id: OP_MODULE_ID,
  name: 'OP 后台图色模块',
  version: '1.0.0',
  category: '图像',
  description: '基于开源 WallBreaker2/op（MIT，随包内置运行库）的大漠风格后台自动化全家桶：窗口后台绑定（GDI/DXGI/WGC/D3D9-12/OpenGL 后端，模拟器最小化截图）、后台键鼠模拟（消息/注入/拟人轨迹）、找色找图多点找色、OpenCV 高级匹配、大漠兼容点阵字库识字、进程内存读写、YOLO 检测与 A 星寻路，共 214 条命令（213 条与上游 C API 一一对应 + 模块级 后台_取错误）。通用文字识别（照片/截图自然文字）请用 微信OCR识别模块，本模块专注后台与点阵字库场景。',
  tags: ['后台绑定', '图色', '找图', '找色', '按键模拟', '模拟器', '点阵字库', 'OCR', '内存', 'OpenCV', 'YOLO'],
  types: [
    { name: 'OP句柄', description: '后台_创建 返回的引擎实例句柄；全部 后台_ 命令的第一参数，用 后台_销毁 释放。', cppType: 'long long' }
  ],
  docs: [{ title: 'OP 后台图色模块使用说明', path: 'docs/modules/op/README.md' }],
  snippets: [
    {
      label: 'OP 后台绑定并找图点击',
      description: '创建句柄、找窗口、后台绑定、找图命中后后台点击的完整骨架。',
      insertText: [
        '局部 OP句柄 句柄 = 后台_创建()',
        '如果(句柄 != 0)',
        '    局部 长整数型 窗口句柄 = 后台_找窗口(句柄, "", "$1")',
        '    如果(窗口句柄 != 0)',
        '        后台_绑定窗口(句柄, 窗口句柄, "gdi", "windows", "windows", 0)',
        '        局部 整数型 按钮横 = 0',
        '        局部 整数型 按钮纵 = 0',
        '        如果(后台_找图(句柄, 0, 0, 399, 299, "$2", "", 0.9, 0, 按钮横, 按钮纵))',
        '            后台_移动到(句柄, 按钮横 + 5, 按钮纵 + 5)',
        '            后台_左键单击(句柄)',
        '        否则',
        '            调试输出("未找到按钮图")',
        '        结束',
        '    否则',
        '        调试输出("未找到窗口")',
        '    结束',
        '    后台_销毁(句柄)',
        '结束'
      ].join('\n')
    },
    {
      label: 'OP 点阵字库识字',
      description: '加载大漠格式字库并识字的基本骨架。',
      insertText: [
        '局部 OP句柄 句柄 = 后台_创建()',
        '如果(句柄 != 0)',
        '    后台_绑定窗口(句柄, 窗口句柄, "gdi", "windows", "windows", 0)',
        '    后台_加载字库(句柄, 0, "$1")',
        '    后台_切换字库(句柄, 0)',
        '    调试输出(后台_识字(句柄, 0, 0, 200, 30, "FFFFFF-000000", 0.9))',
        '    后台_销毁(句柄)',
        '结束'
      ].join('\n')
    }
  ],
  commands: OP_COMMANDS
});

/** 随附 op C API 运行库按架构登记进 targets：VS 工程各平台配置平铺复制到 exe 同目录。 */
export const OP_MODULE: LingBuilderModuleManifest = {
  ...opStandardModule,
  targets: [
    { id: 'windows-msvc-win32', platform: 'windows', arch: 'win32', toolchain: 'msvc', runtimeFiles: ['x86/op_c_api_x86.dll'] },
    { id: 'windows-msvc-x64', platform: 'windows', arch: 'x64', toolchain: 'msvc', runtimeFiles: ['x64/op_c_api_x64.dll'] }
  ]
};
