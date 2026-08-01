import type { LingBuilderModuleManifest } from './types';

export const PROTOBUF_MODULE_ID = 'lingbuilder.data.protobuf';

export const PROTOBUF_MODULE: LingBuilderModuleManifest = {
  schemaVersion: 2,
  id: PROTOBUF_MODULE_ID,
  name: 'Protocol Buffers 模块',
  version: '1.0.0',
  category: '其他',
  description: '使用受控 protoc 生成 C++ 消息代码，并通过字节集和反射句柄完成序列化。',
  author: 'LingBuilder',
  license: 'Apache-2.0',
  tags: ['Protocol Buffers', 'protobuf', 'protoc', '字节集'],
  dependencies: [],
  contributes: {
    commands: [
      { name: 'PB_加载描述集', signature: 'PB_加载描述集(路径)', description: '加载 protoc 生成的 descriptor set，成功返回描述集句柄。', insertText: 'PB_加载描述集("$1")', returnType: '句柄' },
      { name: 'PB_创建消息', signature: 'PB_创建消息(描述集, 类型名)', description: '按完整消息类型名创建反射消息句柄。', insertText: 'PB_创建消息($1, "$2")', returnType: '句柄' },
      { name: 'PB_从字节集解析', signature: 'PB_从字节集解析(消息, 数据)', description: '把字节集解析到消息句柄。', insertText: 'PB_从字节集解析($1, $2)', returnType: '逻辑型' },
      { name: 'PB_序列化为字节集', signature: 'PB_序列化为字节集(消息)', description: '把消息序列化为正式字节集。', insertText: 'PB_序列化为字节集($1)', returnType: '字节集' },
      { name: 'PB_从JSON', signature: 'PB_从JSON(消息, JSON)', description: '按 Protobuf JSON 语义填充消息。', insertText: 'PB_从JSON($1, "$2")', returnType: '逻辑型' },
      { name: 'PB_到JSON', signature: 'PB_到JSON(消息)', description: '按 Protobuf JSON 语义导出消息。', insertText: 'PB_到JSON($1)', returnType: '文本型' },
      { name: 'PB_取最后错误', signature: 'PB_取最后错误()', description: '返回当前线程最近一次 Protobuf 错误。', insertText: 'PB_取最后错误()', returnType: '文本型' },
      { name: 'PB_释放消息', signature: 'PB_释放消息(消息)', description: '释放消息句柄。', insertText: 'PB_释放消息($1)', returnType: '空' },
      { name: 'PB_释放描述集', signature: 'PB_释放描述集(描述集)', description: '释放描述集句柄。', insertText: 'PB_释放描述集($1)', returnType: '空' }
    ],
    docs: [{ title: 'Protocol Buffers 模块手册', path: 'docs/modules/protobuf/README.md' }],
    examples: [{ title: '基础消息序列化', path: 'docs/modules/protobuf/examples/basic.lcpp', description: '展示描述集、字节集和 JSON 的基本调用。' }]
  },
  build: {
    codeGenerators: [{
      id: 'protobuf-cpp',
      provider: 'lingbuilder.protobuf.protoc',
      version: '1.0.0',
      inputs: { include: ['**/*.proto'], exclude: ['generated/**', '.lingbuilder-build/**'] },
      outputs: [{ path: 'generated/protobuf/descriptor.pb', kind: 'descriptor' }],
      options: { outputDirectory: 'generated/protobuf', runtimeVersion: 'pinned' },
      targetIds: ['windows-msvc-win32', 'windows-msvc-x64']
    }]
  },
  targets: [
    { id: 'windows-msvc-win32', platform: 'windows', arch: 'win32', toolchain: 'msvc', includeDirs: ['sdk/include'], libs: ['sdk/lib/libprotobuf.lib'], runtimeFiles: ['sdk/bin/libprotobuf.dll'], defines: ['LINGBUILDER_PROTOBUF_MODULE'] },
    { id: 'windows-msvc-x64', platform: 'windows', arch: 'x64', toolchain: 'msvc', includeDirs: ['sdk/include'], libs: ['sdk/lib/libprotobuf.lib'], runtimeFiles: ['sdk/bin/libprotobuf.dll'], defines: ['LINGBUILDER_PROTOBUF_MODULE'] }
  ],
  bindings: {
    commands: [
      { command: 'PB_加载描述集', runtimeName: 'PB_加载描述集', parameters: [{ name: '路径', type: 'wideString' }], returnType: 'handle', encoding: 'wide' },
      { command: 'PB_创建消息', runtimeName: 'PB_创建消息', parameters: [{ name: '描述集', type: 'handle' }, { name: '类型名', type: 'wideString' }], returnType: 'handle', encoding: 'wide' },
      { command: 'PB_从字节集解析', runtimeName: 'PB_从字节集解析', parameters: [{ name: '消息', type: 'handle' }, { name: '数据', type: 'bytes' }], returnType: 'bool' },
      { command: 'PB_序列化为字节集', runtimeName: 'PB_序列化为字节集', parameters: [{ name: '消息', type: 'handle' }], returnType: 'bytes' },
      { command: 'PB_从JSON', runtimeName: 'PB_从JSON', parameters: [{ name: '消息', type: 'handle' }, { name: 'JSON', type: 'wideString' }], returnType: 'bool', encoding: 'wide' },
      { command: 'PB_到JSON', runtimeName: 'PB_到JSON', parameters: [{ name: '消息', type: 'handle' }], returnType: 'wideString', encoding: 'wide' },
      { command: 'PB_取最后错误', runtimeName: 'PB_取最后错误', returnType: 'wideString', encoding: 'wide' },
      { command: 'PB_释放消息', runtimeName: 'PB_释放消息', parameters: [{ name: '消息', type: 'handle' }], returnType: 'void' },
      { command: 'PB_释放描述集', runtimeName: 'PB_释放描述集', parameters: [{ name: '描述集', type: 'handle' }], returnType: 'void' }
    ]
  }
};
