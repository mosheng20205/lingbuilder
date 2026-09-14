import type { LingBuilderModuleManifest } from './types';
import { createStandardModule } from './standardLibraryModules';

// 网页访问模块：易语言风格 网页_访问_对象 / 网页_异步访问 命令族。
// 运行时实现内置于生成模板（lingCppWin32Project.ts 中 #ifdef LINGBUILDER_WEB_HTTP_MODULE 块），
// 因此 targets 必须携带 LINGBUILDER_WEB_HTTP_MODULE 定义，缺省时生成源码不含本模块运行时。
export const WEB_HTTP_MODULE: LingBuilderModuleManifest = {
  ...createStandardModule({
    id: 'lingbuilder.web.http',
    name: '网页访问模块',
    version: '1.1.1',
    category: '网络',
    description: '基于 Windows WinHTTP 封装易语言风格的网页_访问_对象命令，支持 GET、POST、Cookie、请求头、响应头、状态码、代理、超时和重定向控制，并提供回到 UI 主线程的网页_异步访问后台线程命令族。',
    tags: ['网络', 'HTTP', 'HTTPS', 'WinHTTP', '易语言兼容', '异步'],
    docs: [{ title: '网页访问模块使用说明', path: 'docs/modules/web-http/README.md' }],
    snippets: [
      {
        label: '网页访问 GET',
        insertText: '网页_访问_对象("https://example.com", 0)\n调试输出(网页_取返回文本())',
        description: '发起 GET 请求并输出返回文本。'
      },
      {
        label: '网页访问 POST',
        insertText: '网页_访问_对象("https://example.com/api", 1, "name=lingbuilder")\n调试输出(网页_取返回状态代码())',
        description: '发起 UTF-8 表单 POST 请求并输出状态码。'
      },
      {
        label: '网页异步访问',
        insertText: '网页_异步访问("https://example.com", 0, &网页访问完成)',
        description: '在窗口事件中启动后台线程访问，完成处理器在 UI 主线程执行。'
      }
    ],
    commands: [
      {
        name: '网页_异步访问',
        signature: '网页_异步访问(网址, 访问方式, 完成处理器)',
        description: '在受控后台线程中访问网页，立即返回请求编号；完成处理器使用 &处理器名 引用，并在 UI 主线程执行。',
        insertText: '网页_异步访问("${1:https://example.com}", 0, &${2:网页访问完成})',
        parameters: [
          { name: '网址', type: 'wideString', description: '要访问的完整 HTTP/HTTPS 地址，例如 https://ipinfo.io/json。' },
          { name: '访问方式', type: 'int', description: '0=GET，1=POST，2=HEAD，3=PUT，4=OPTIONS，5=DELETE，6=TRACE，7=CONNECT，8=PATCH' },
          { name: '完成处理器', type: 'handler', description: '当前窗口中的无参数事件或方法引用，使用 &处理器名' }
        ],
        returnType: 'int',
        returnDescription: '成功启动时返回大于 0 的请求编号，用于读取本次请求的文本、状态码和错误信息；返回 0 表示网址或完成处理器无效，或者后台线程未能启动。此返回值不是 HTTP 状态码。',
        example: '网页_异步访问("https://example.com", 0, &网页访问完成)'
      },
      {
        name: '网页_异步取返回文本',
        signature: '网页_异步取返回文本(请求编号)',
        description: '按请求编号读取异步网页访问的 UTF-8 文本结果。',
        insertText: '网页_异步取返回文本($1)',
        parameters: [{ name: '请求编号', type: 'int', description: '网页_异步访问 返回的请求编号。' }],
        returnType: 'wideString'
      },
      {
        name: '网页_异步取状态代码',
        signature: '网页_异步取状态代码(请求编号)',
        description: '按请求编号读取 HTTP 状态代码。',
        insertText: '网页_异步取状态代码($1)',
        parameters: [{ name: '请求编号', type: 'int', description: '网页_异步访问 返回的请求编号。' }],
        returnType: 'int'
      },
      {
        name: '网页_异步取错误信息',
        signature: '网页_异步取错误信息(请求编号)',
        description: '按请求编号读取异步访问的中文错误信息。',
        insertText: '网页_异步取错误信息($1)',
        parameters: [{ name: '请求编号', type: 'int', description: '网页_异步访问 返回的请求编号。' }],
        returnType: 'wideString'
      },
      {
        name: '网页_异步取当前请求编号',
        signature: '网页_异步取当前请求编号()',
        description: '在异步完成处理器中读取当前正在分发的请求编号。',
        insertText: '网页_异步取当前请求编号()',
        parameters: [],
        returnType: 'int'
      },
      {
        name: '网页_异步取消',
        signature: '网页_异步取消(请求编号)',
        description: '标记取消指定异步请求；当前 WinHTTP 请求返回后会以已取消状态分发完成处理器。',
        insertText: '网页_异步取消($1)',
        parameters: [{ name: '请求编号', type: 'int', description: '网页_异步访问 返回的请求编号。' }],
        returnType: 'bool'
      },
      {
        name: '网页_访问_对象',
        signature: '网页_访问_对象(网址, 访问方式, 提交信息, 提交Cookies, 返回Cookies, 附加协议头, 返回协议头, 返回状态代码, 禁止重定向, 字节集提交, 代理地址, 超时, 代理用户名, 代理密码, 代理标识, 对象继承, 是否自动合并更新Cookie, 是否补全必要协议头, 是否处理协议头大小写)',
        description: '使用 WinHTTP 对象方式访问网页。访问方式：0=GET，1=POST，2=HEAD，3=PUT，4=OPTIONS，5=DELETE，6=TRACE，7=CONNECT，8=PATCH。',
        insertText: '网页_访问_对象("${1:https://example.com}", 0)',
        parameters: [
          { name: '网址', type: 'wideString', description: '完整网页地址，必须包含 http:// 或 https://' },
          { name: '访问方式', type: 'int', description: '0=GET，1=POST，2=HEAD，3=PUT，4=OPTIONS，5=DELETE，6=TRACE，7=CONNECT，8=PATCH' },
          { name: '提交信息', type: 'wideString', description: 'POST 专用，自动 UTF-8 编码' },
          { name: '提交Cookies', type: 'wideString', description: '设置提交时的 Cookie' },
          { name: '返回Cookies', type: 'wideString', description: '当前生成器暂以 网页_取返回Cookies 读取' },
          { name: '附加协议头', type: 'wideString', description: '一行一个协议头' },
          { name: '返回协议头', type: 'wideString', description: '当前生成器暂以 网页_取返回协议头 读取' },
          { name: '返回状态代码', type: 'int', description: '当前生成器暂以 网页_取返回状态代码 读取' },
          { name: '禁止重定向', type: 'bool', description: '为真时禁止自动重定向。' },
          { name: '字节集提交', type: 'bytes', description: '以字节集作为请求正文提交。' },
          { name: '代理地址', type: 'wideString', description: '格式如 8.8.8.8:88' },
          { name: '超时', type: 'int', description: '秒，默认 15，-1 为无限等待' },
          { name: '代理用户名', type: 'wideString', description: '代理身份验证用户名。' },
          { name: '代理密码', type: 'wideString', description: '代理身份验证密码。' },
          { name: '代理标识', type: 'int', description: '默认 1，0 使用系统默认代理' },
          { name: '对象继承', type: 'raw', description: '预留 WinHTTP 对象继承入口' },
          { name: '是否自动合并更新Cookie', type: 'bool', description: '为真时自动合并响应中的 Cookie。' },
          { name: '是否补全必要协议头', type: 'bool', description: '为真时自动补全 Referer、User-Agent 等必要协议头。' },
          { name: '是否处理协议头大小写', type: 'bool', description: '为真时统一协议头名称大小写。' }
        ],
        returnType: 'bytes',
        returnDescription: '返回 HTTP 响应体的原始字节集；请求失败返回空字节集，可通过 网页_取错误信息 读取中文错误、网页_取返回状态代码 读取状态码。',
        example: '网页_访问_对象("https://example.com", 0)'
      },
      {
        name: '网页_取返回文本',
        signature: '网页_取返回文本()',
        description: '读取最近一次网页_访问_对象返回的 UTF-8 文本内容。',
        insertText: '网页_取返回文本()',
        parameters: [],
        returnType: 'wideString'
      },
      {
        name: '网页_取返回Cookies',
        signature: '网页_取返回Cookies()',
        description: '读取最近一次网页_访问_对象返回的 Cookie。',
        insertText: '网页_取返回Cookies()',
        parameters: [],
        returnType: 'wideString'
      },
      {
        name: '网页_取返回协议头',
        signature: '网页_取返回协议头()',
        description: '读取最近一次网页_访问_对象返回的响应协议头。',
        insertText: '网页_取返回协议头()',
        parameters: [],
        returnType: 'wideString'
      },
      {
        name: '网页_取返回状态代码',
        signature: '网页_取返回状态代码()',
        description: '读取最近一次网页_访问_对象返回的 HTTP 状态代码。',
        insertText: '网页_取返回状态代码()',
        parameters: [],
        returnType: 'int'
      },
      {
        name: '网页_取错误信息',
        signature: '网页_取错误信息()',
        description: '读取最近一次网页访问失败时的中文错误信息。',
        insertText: '网页_取错误信息()',
        parameters: [],
        returnType: 'wideString'
      }
    ]
  }),
  tags: ['内置', '网络', 'HTTP', 'HTTPS', 'WinHTTP', '易语言兼容', '异步'],
  targets: [
    { id: 'windows-msvc-win32', platform: 'windows', arch: 'win32', toolchain: 'msvc', defines: ['LINGBUILDER_WEB_HTTP_MODULE'] },
    { id: 'windows-msvc-x64', platform: 'windows', arch: 'x64', toolchain: 'msvc', defines: ['LINGBUILDER_WEB_HTTP_MODULE'] }
  ]
};
