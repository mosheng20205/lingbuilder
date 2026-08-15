import type {
  LingBuilderModuleManifest,
  ModuleCommandBindingParameter,
  ModuleCommandValueType
} from './types';

export const ARIA2_MODULE_ID = 'lingbuilder.net.aria2';
export const ARIA2_VERSION = '1.37.0';
export const ARIA2_RUNTIME_FILES = ['runtime/aria2c.exe', 'runtime/COPYING', 'runtime/NOTICE.md'] as const;

interface Aria2CommandSpec {
  name: string;
  signature: string;
  description: string;
  parameters: ModuleCommandBindingParameter[];
  returnType: ModuleCommandValueType;
  returnLabel: string;
  category: string;
  insertText: string;
}

const parameter = (
  name: string,
  type: ModuleCommandValueType,
  description?: string
): ModuleCommandBindingParameter => ({ name, type, description });

export const ARIA2_COMMAND_SPECS: readonly Aria2CommandSpec[] = [
  {
    name: 'Aria2_下载',
    signature: 'Aria2_下载(地址, 保存目录, 文件名, 连接数, 最小分段MB, [下载进度处理器])',
    description: '使用随项目分发的 aria2c 创建异步下载任务。仅接受 HTTP、HTTPS、FTP、FTPS 或 magnet 地址；连接数范围为 1 至 16，分段范围为 1 至 64 MB。可选下载进度处理器会在窗口线程接收实时任务快照。',
    parameters: [
      parameter('地址', 'wideString', '允许的远程下载地址。'),
      parameter('保存目录', 'wideString', '不存在时自动创建的目标目录。'),
      parameter('文件名', 'wideString', '只允许普通文件名，不允许目录或路径穿越。'),
      parameter('连接数', 'int', '每台服务器的最大连接数，范围 1 至 16。'),
      parameter('最小分段MB', 'int', 'aria2 最小分段大小，范围 1 至 64 MB。'),
      {
        name: '下载进度处理器',
        type: 'handler',
        description: '可选。必须使用 &处理器名；任务下载期间会在窗口线程回调。',
        handlerSignature: {
          parameterTypes: ['Aria2任务', '整数型', '长整数型', '长整数型', '长整数型', '文本型'],
          returnType: '空'
        },
        optional: true,
        defaultValue: null
      }
    ],
    returnType: 'Aria2任务',
    returnLabel: 'Aria2任务',
    category: '下载任务',
    insertText: 'Aria2_下载("https://example.com/file.zip", "downloads", "file.zip", 8, 8, &$1)'
  },
  {
    name: 'Aria2_等待',
    signature: 'Aria2_等待(任务, 超时毫秒)',
    description: '等待下载结束。返回真表示任务成功完成；超时、停止或下载失败均返回假。超时毫秒为 0 时只检查当前状态。',
    parameters: [parameter('任务', 'Aria2任务'), parameter('超时毫秒', 'int')],
    returnType: 'bool',
    returnLabel: '逻辑型',
    category: '下载任务',
    insertText: 'Aria2_等待($1, 60000)'
  },
  {
    name: 'Aria2_取状态',
    signature: 'Aria2_取状态(任务)',
    description: '返回“下载中”“已完成”“已失败”或“已停止”。',
    parameters: [parameter('任务', 'Aria2任务')],
    returnType: 'wideString',
    returnLabel: '文本型',
    category: '状态',
    insertText: 'Aria2_取状态($1)'
  },
  {
    name: 'Aria2_取进度',
    signature: 'Aria2_取进度(任务)',
    description: '返回 aria2 已报告的下载进度百分比；未知时为 0，成功完成时为 100。',
    parameters: [parameter('任务', 'Aria2任务')],
    returnType: 'int',
    returnLabel: '整数型',
    category: '状态',
    insertText: 'Aria2_取进度($1)'
  },
  {
    name: 'Aria2_取已下载字节',
    signature: 'Aria2_取已下载字节(任务)',
    description: '读取当前目标文件的实际字节数，适合显示下载量。',
    parameters: [parameter('任务', 'Aria2任务')],
    returnType: 'longLong',
    returnLabel: '长整数型',
    category: '状态',
    insertText: 'Aria2_取已下载字节($1)'
  },
  {
    name: 'Aria2_取总字节',
    signature: 'Aria2_取总字节(任务)',
    description: '返回任务结束后确认的文件总字节数；下载尚未结束或服务器未报告时可能为 0。',
    parameters: [parameter('任务', 'Aria2任务')],
    returnType: 'longLong',
    returnLabel: '长整数型',
    category: '状态',
    insertText: 'Aria2_取总字节($1)'
  },
  {
    name: 'Aria2_取错误',
    signature: 'Aria2_取错误(任务)',
    description: '读取任务最近一次中文错误或 aria2 输出尾部。任务成功时返回空文本。',
    parameters: [parameter('任务', 'Aria2任务')],
    returnType: 'wideString',
    returnLabel: '文本型',
    category: '状态',
    insertText: 'Aria2_取错误($1)'
  },
  {
    name: 'Aria2_取下载速度',
    signature: 'Aria2_取下载速度(任务)',
    description: '按目标文件最近一次采样返回下载速度，单位为字节/秒；适合定时刷新下载面板。',
    parameters: [parameter('任务', 'Aria2任务')],
    returnType: 'longLong',
    returnLabel: '长整数型',
    category: '状态',
    insertText: 'Aria2_取下载速度($1)'
  },
  {
    name: 'Aria2_取保存目录',
    signature: 'Aria2_取保存目录(任务)',
    description: '返回任务实际使用的绝对保存目录；任务不存在时返回空文本。',
    parameters: [parameter('任务', 'Aria2任务')],
    returnType: 'wideString',
    returnLabel: '文本型',
    category: '状态',
    insertText: 'Aria2_取保存目录($1)'
  },
  {
    name: 'Aria2_打开目录',
    signature: 'Aria2_打开目录(任务)',
    description: '使用系统文件管理器打开任务的实际保存目录；目录来自任务句柄，不接受任意外部路径。',
    parameters: [parameter('任务', 'Aria2任务')],
    returnType: 'bool',
    returnLabel: '逻辑型',
    category: '文件位置',
    insertText: 'Aria2_打开目录($1)'
  },
  {
    name: 'Aria2_停止',
    signature: 'Aria2_停止(任务)',
    description: '停止 aria2 子进程并保留 aria2 的断点续传元数据；再次创建同目录同文件名任务可继续下载。',
    parameters: [parameter('任务', 'Aria2任务')],
    returnType: 'bool',
    returnLabel: '逻辑型',
    category: '下载任务',
    insertText: 'Aria2_停止($1)'
  },
  {
    name: 'Aria2_释放',
    signature: 'Aria2_释放(任务)',
    description: '停止仍在运行的任务并释放其本地句柄和状态记录。',
    parameters: [parameter('任务', 'Aria2任务')],
    returnType: 'bool',
    returnLabel: '逻辑型',
    category: '下载任务',
    insertText: 'Aria2_释放($1)'
  }
];

export const ARIA2_MODULE: LingBuilderModuleManifest = {
  schemaVersion: 2,
  id: ARIA2_MODULE_ID,
  name: 'Aria2 下载模块',
  displayName: 'Aria2 下载',
  version: ARIA2_VERSION,
  minLingBuilderVersion: '0.4.0',
  category: '网络',
  description: '基于 aria2 1.37.0 的受控异步下载模块，支持多连接、分段、断点续传、速度/进度/目录查询和安全打开目录。生成项目会携带经过许可声明的 aria2c.exe。',
  author: 'LingBuilder',
  license: 'GPL-2.0-only',
  tags: ['内置', 'Aria2', '下载', '多线程', '断点续传', 'Windows x64'],
  contributes: {
    commands: ARIA2_COMMAND_SPECS.map(spec => ({
      name: spec.name,
      signature: spec.signature,
      description: spec.description,
      insertText: spec.insertText,
      returnType: spec.returnLabel,
      category: spec.category,
      officialCapability: true
    })),
    types: [{
      name: 'Aria2任务',
      description: '由 Aria2 下载模块管理的异步下载任务句柄，完成后应调用 Aria2_释放。',
      cppType: 'long long'
    }],
    snippets: [{
      label: 'Aria2 异步下载与状态查询',
      insertText: '事件 下载进度(Aria2任务 任务, 整数型 进度, 长整数型 已下载字节, 长整数型 总字节, 长整数型 速度字节每秒, 文本型 状态)\n    调试输出(格式化文本("进度={}%，速度={} 字节/秒，状态={}", 进度, 速度字节每秒, 状态))\n结束\n\n局部 Aria2任务 任务 = Aria2_下载("https://example.com/file.zip", "downloads", "file.zip", 8, 8, &下载进度)\n如果 (Aria2_等待(任务, 60000))\n    调试输出("下载完成：" + Aria2_取保存目录(任务))\n否则\n    调试输出(Aria2_取错误(任务))\n如果结束\nAria2_释放(任务)',
      description: '创建受控 aria2 下载任务，在窗口线程接收实时进度，并在完成后输出保存目录。'
    }],
    docs: [{ title: 'Aria2 下载模块手册', path: 'docs/modules/aria2/README.md' }],
    examples: [{
      title: 'Aria2 下载任务示例',
      path: 'docs/modules/aria2/examples/basic.lcpp',
      description: '展示下载、等待、状态与错误处理。'
    }]
  },
  targets: [{
    id: 'windows-msvc-x64',
    platform: 'windows',
    arch: 'x64',
    toolchain: 'msvc',
    runtimeFiles: [...ARIA2_RUNTIME_FILES],
    defines: ['LINGBUILDER_ARIA2_MODULE']
  }],
  bindings: {
    commands: ARIA2_COMMAND_SPECS.map(spec => ({
      command: spec.name,
      runtimeName: spec.name,
      parameters: spec.parameters,
      returnType: spec.returnType,
      encoding: 'wide',
      example: spec.insertText,
      description: spec.description
    }))
  }
};
