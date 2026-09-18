import { createStandardModule } from './standardLibraryModules';

/**
 * 内嵌资源模块：按逻辑名读取构建期打进 EXE 的资源（图片、文本、zip、DLL 字节等任意格式）。
 * 资源清单属于项目模型（LingWindowProject.embeddedResources），运行期实现由
 * windowDesigner/embeddedResourceRuntime.ts 按项目生成。
 */
export const EMBEDDED_RESOURCE_MODULE = createStandardModule({
  id: 'lingbuilder.resource.embed',
  name: '内嵌资源模块',
  category: '系统',
  description: '按逻辑名读取构建期以 RCDATA 打进 EXE 的项目内嵌资源（任意格式：图片、文本、zip、DLL 字节集等），全程不落盘。',
  tags: ['内嵌资源', '资源'],
  docs: [{ title: '内嵌资源模块使用说明', path: 'docs/modules/embedded-resource/README.md' }],
  commands: [
    {
      name: '资源_取字节集',
      signature: '资源_取字节集(逻辑名)',
      description: '把内嵌资源读成字节集（失败返回空字节集，原因见 资源_取错误信息）。可直接喂给 内存DLL_加载、图片控件或网络上传。',
      insertText: '资源_取字节集("$1")',
      parameters: [{ name: '逻辑名', type: 'wideString', description: '项目内嵌资源清单里的逻辑名，就是工作区内相对路径原样，如 "assets/logo.png"、"assets/包.zip"；大小写与斜杠方向不敏感。' }],
      returnType: 'bytes',
      example: '局部 字节集 图标数据\n图标数据 = 资源_取字节集("assets/logo.png")'
    },
    {
      name: '资源_取文本',
      signature: '资源_取文本(逻辑名)',
      description: '把内嵌资源按 UTF-8 解码为文本（失败返回空文本）。适合内嵌的 txt/json/html 等文本文件。',
      insertText: '资源_取文本("$1")',
      parameters: [{ name: '逻辑名', type: 'wideString', description: '内嵌资源的逻辑名，如 "assets/说明.txt"；文件不是 UTF-8 时会出现乱码，请先转成 UTF-8 再内嵌。' }],
      returnType: 'wideString',
      example: '调试输出(资源_取文本("assets/说明.txt"))'
    },
    {
      name: '资源_是否存在',
      signature: '资源_是否存在(逻辑名)',
      description: '判断内嵌资源是否存在（资源清单里声明且 EXE 里能取到）。',
      insertText: '资源_是否存在("$1")',
      parameters: [{ name: '逻辑名', type: 'wideString', description: '要检查的内嵌资源逻辑名。' }],
      returnType: 'bool'
    },
    {
      name: '资源_取大小',
      signature: '资源_取大小(逻辑名)',
      description: '返回内嵌资源的字节数；资源不存在时返回 0 并写入中文错误信息。',
      insertText: '资源_取大小("$1")',
      parameters: [{ name: '逻辑名', type: 'wideString', description: '要查询的内嵌资源逻辑名；返回映像里的原始字节数（不会复制数据）。' }],
      returnType: 'int'
    },
    {
      name: '资源_列表',
      signature: '资源_列表()',
      description: '返回全部内嵌资源的逻辑名（每行一个），用于自检与调试。',
      insertText: '资源_列表()',
      parameters: [],
      returnType: 'wideString',
      example: '调试输出(资源_列表())'
    },
    {
      name: '资源_保存到文件',
      signature: '资源_保存到文件(逻辑名, 路径)',
      description: '把内嵌资源写成真实文件（覆盖写），返回文件路径；失败返回空文本。供只接受磁盘路径的第三方 API 使用。',
      insertText: '资源_保存到文件("$1", "$2")',
      parameters: [
        { name: '逻辑名', type: 'wideString', description: '要写出的内嵌资源逻辑名。' },
        { name: '路径', type: 'wideString', description: '目标文件完整路径（不存在时不会自动建目录）；已存在会被覆盖。' }
      ],
      returnType: 'wideString',
      example: '局部 文本型 路径 = 资源_保存到文件("assets/包.zip", 系统_取临时目录() + "包.zip")'
    },
    {
      name: '资源_释放到临时目录',
      signature: '资源_释放到临时目录(逻辑名)',
      description: '把内嵌资源释放到 %TEMP%\\lingbuilder-embedded\\<工程ID>\\ 下（保持逻辑名的子目录结构），返回文件路径；适合"必须给磁盘文件"的库。',
      insertText: '资源_释放到临时目录("$1")',
      parameters: [{ name: '逻辑名', type: 'wideString', description: '要释放的内嵌资源逻辑名；子目录会自动创建，同一路径重复释放会覆盖写。' }],
      returnType: 'wideString',
      example: '调试输出(资源_释放到临时目录("assets/包.zip"))'
    },
    {
      name: '资源_取错误信息',
      signature: '资源_取错误信息()',
      description: '返回最近一次内嵌资源操作的中文错误原因（例如逻辑名未声明、EXE 里没有该资源）。',
      insertText: '资源_取错误信息()',
      parameters: [],
      returnType: 'wideString',
      example: '调试输出(资源_取错误信息())'
    }
  ]
});
