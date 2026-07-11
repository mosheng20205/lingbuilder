import { LingBuilderModuleManifest } from './types';
import { getWin32ControlsForModule, Win32ControlModuleId } from '../windowDesigner/win32ControlRegistry';

function createControlContributions(moduleId: Win32ControlModuleId) {
  return getWin32ControlsForModule(moduleId).map(definition => ({
    type: definition.type,
    label: definition.label,
    category: definition.category,
    icon: definition.icon,
    isContainer: definition.isContainer,
    isVisual: definition.isVisual,
    nativeAdapter: definition.nativeAdapter,
    requiredLibraries: definition.requiredLibraries,
    defaultProps: definition.defaultProps,
    properties: definition.properties,
    events: definition.events.map(event => ({
      name: event.name,
      label: event.label,
      handlerPattern: `_{controlName}_${event.handlerSuffix}`
    }))
  }));
}

function createControlTypes(moduleId: Win32ControlModuleId) {
  return getWin32ControlsForModule(moduleId).map(definition => ({
    name: definition.label.split('/')[0],
    description: `Win32 ${definition.label}控件。`,
    cppType: 'HWND'
  }));
}

export const BUILTIN_MODULES: LingBuilderModuleManifest[] = [
  {
    schemaVersion: 2,
    id: 'lingbuilder.win32.basic',
    name: 'Win32窗口基础模块',
    version: '1.0.0',
    category: '界面',
    description: '提供窗口、基础控件、信息框、调试输出和结束等中文 C++ 基础能力。',
    author: 'LingBuilder',
    tags: ['内置', 'Win32', '中文代码'],
    contributes: {
      commands: [
        {
          name: '信息框',
          signature: '信息框(内容, 标志, 标题)',
          description: '显示一个 Win32 系统消息框。',
          insertText: '信息框("$1", 64, "提示")',
          returnType: '整数型'
        },
        {
          name: '调试输出',
          signature: '调试输出(内容)',
          description: '向调试输出窗口和控制台输出文本。',
          insertText: '调试输出("$1")',
          returnType: '空'
        },
        {
          name: '结束',
          signature: '结束()',
          description: '关闭当前窗口。',
          insertText: '结束()',
          returnType: '空'
        }
      ],
      types: [
        { name: '窗口', description: 'Win32 窗口基类。', cppType: 'LingWindowBase' },
        ...createControlTypes('lingbuilder.win32.basic')
      ],
      designerControls: createControlContributions('lingbuilder.win32.basic'),
    },
    targets: [
      {
        id: 'windows-msvc-win32',
        platform: 'windows',
        arch: 'win32',
        toolchain: 'msvc',
        libs: ['comctl32.lib'],
        defines: ['UNICODE', '_UNICODE']
      }
    ],
    bindings: {
      commands: [
        {
          command: '信息框',
          runtimeName: '信息框',
          parameters: [
            { name: '内容', type: 'wideString' },
            { name: '标志', type: 'int' },
            { name: '标题', type: 'wideString' }
          ],
          returnType: 'int',
          encoding: 'wide',
          example: '信息框("你好", 64, "提示")'
        },
        {
          command: '调试输出',
          runtimeName: '调试输出',
          parameters: [{ name: '内容', type: 'wideString' }],
          returnType: 'void',
          encoding: 'wide',
          example: '调试输出("按钮被单击")'
        },
        {
          command: '结束',
          runtimeName: '结束',
          parameters: [],
          returnType: 'void',
          example: '结束()'
        }
      ]
    }
  },
  {
    schemaVersion: 2,
    id: 'lingbuilder.win32.common-controls',
    name: 'Win32高级控件模块',
    version: '1.0.0',
    category: '界面',
    description: '提供列表视图、树形视图、选项卡、日期、工具栏、状态栏、富文本和系统通用对话框等标准 Win32 控件。',
    author: 'LingBuilder',
    tags: ['内置', 'Win32', 'Common Controls', '富文本', '系统对话框'],
    contributes: {
      commands: [
        { name: '打开文件', signature: '打开文件(标题, 筛选器)', description: '显示 Windows 文件打开对话框并返回路径。', insertText: '打开文件("选择文件", "所有文件|*.*")', returnType: '文本型' },
        { name: '保存文件', signature: '保存文件(标题, 筛选器)', description: '显示 Windows 文件保存对话框并返回路径。', insertText: '保存文件("保存文件", "所有文件|*.*")', returnType: '文本型' },
        { name: '选择文件夹', signature: '选择文件夹(标题)', description: '显示 Windows 文件夹选择对话框并返回路径。', insertText: '选择文件夹("选择文件夹")', returnType: '文本型' },
        { name: '选择颜色', signature: '选择颜色(默认颜色)', description: '显示系统颜色对话框并返回 COLORREF 整数。', insertText: '选择颜色(0)', returnType: '整数型' },
        { name: '选择字体', signature: '选择字体(默认字号)', description: '显示系统字体对话框并返回字体说明。', insertText: '选择字体(12)', returnType: '文本型' },
        { name: '查找文本', signature: '查找文本(默认文本)', description: '显示系统查找对话框。', insertText: '查找文本("$1")', returnType: '空' },
        { name: '替换文本', signature: '替换文本(查找内容, 替换内容)', description: '显示系统替换对话框。', insertText: '替换文本("$1", "$2")', returnType: '空' },
        { name: '打印', signature: '打印()', description: '显示系统打印对话框。', insertText: '打印()', returnType: '逻辑型' },
        { name: '页面设置', signature: '页面设置()', description: '显示系统页面设置对话框。', insertText: '页面设置()', returnType: '逻辑型' },
        { name: '任务对话框', signature: '任务对话框(标题, 内容)', description: '显示 Windows Task Dialog。', insertText: '任务对话框("提示", "$1")', returnType: '整数型' }
      ],
      types: createControlTypes('lingbuilder.win32.common-controls'),
      designerControls: createControlContributions('lingbuilder.win32.common-controls'),
      snippets: [
        { label: '选择文件并输出', insertText: '调试输出(打开文件("选择文件", "所有文件|*.*"))', description: '选择一个文件并输出路径。' },
        { label: '任务对话框提示', insertText: '任务对话框("LingBuilder", "操作完成")', description: '显示标准 Windows 任务对话框。' }
      ]
    },
    targets: [{
      id: 'windows-msvc-win32', platform: 'windows', arch: 'win32', toolchain: 'msvc',
      libs: ['comctl32.lib', 'comdlg32.lib', 'ole32.lib', 'shell32.lib'],
      defines: ['UNICODE', '_UNICODE', 'LINGBUILDER_WIN32_COMMON_CONTROLS']
    }],
    bindings: {
      commands: [
        { command: '打开文件', runtimeName: '打开文件', parameters: [{ name: '标题', type: 'wideString' }, { name: '筛选器', type: 'wideString' }], returnType: 'wideString', encoding: 'wide' },
        { command: '保存文件', runtimeName: '保存文件', parameters: [{ name: '标题', type: 'wideString' }, { name: '筛选器', type: 'wideString' }], returnType: 'wideString', encoding: 'wide' },
        { command: '选择文件夹', runtimeName: '选择文件夹', parameters: [{ name: '标题', type: 'wideString' }], returnType: 'wideString', encoding: 'wide' },
        { command: '选择颜色', runtimeName: '选择颜色', parameters: [{ name: '默认颜色', type: 'int' }], returnType: 'int' },
        { command: '选择字体', runtimeName: '选择字体', parameters: [{ name: '默认字号', type: 'int' }], returnType: 'wideString', encoding: 'wide' },
        { command: '查找文本', runtimeName: '查找文本', parameters: [{ name: '默认文本', type: 'wideString' }], returnType: 'void', encoding: 'wide' },
        { command: '替换文本', runtimeName: '替换文本', parameters: [{ name: '查找内容', type: 'wideString' }, { name: '替换内容', type: 'wideString' }], returnType: 'void', encoding: 'wide' },
        { command: '打印', runtimeName: '打印', parameters: [], returnType: 'bool' },
        { command: '页面设置', runtimeName: '页面设置', parameters: [], returnType: 'bool' },
        { command: '任务对话框', runtimeName: '任务对话框', parameters: [{ name: '标题', type: 'wideString' }, { name: '内容', type: 'wideString' }], returnType: 'int', encoding: 'wide' }
      ]
    }
  },
  {
    schemaVersion: 2,
    id: 'lingbuilder.websocket.client',
    name: 'WebSocket 客户端模块',
    version: '1.0.0',
    category: '网络',
    description: '提供基于 Windows WinHTTP 的 WebSocket 客户端连接、发送、接收和关闭能力。',
    author: 'LingBuilder',
    tags: ['内置', '网络', 'WebSocket', '客户端'],
    contributes: {
      commands: [
        {
          name: 'WS_连接',
          signature: 'WS_连接(地址)',
          description: '连接到 ws:// 或 wss:// WebSocket 服务端，成功返回 1，失败返回 0 并输出中文调试信息。',
          insertText: 'WS_连接("wss://echo.websocket.events")',
          returnType: '整数型'
        },
        {
          name: 'WS_发送文本',
          signature: 'WS_发送文本(内容)',
          description: '向当前 WebSocket 连接发送一条文本消息，成功返回 1。',
          insertText: 'WS_发送文本("$1")',
          returnType: '整数型'
        },
        {
          name: 'WS_接收到调试输出',
          signature: 'WS_接收到调试输出()',
          description: '从当前 WebSocket 连接接收一条文本消息，并写入调试输出。',
          insertText: 'WS_接收到调试输出()',
          returnType: '整数型'
        },
        {
          name: 'WS_接收文本',
          signature: 'WS_接收文本()',
          description: '接收一条文本消息并返回最近接收内容；可在原生 C++ 语句中读取返回值。',
          insertText: 'WS_接收文本()',
          returnType: '文本型'
        },
        {
          name: 'WS_关闭',
          signature: 'WS_关闭()',
          description: '关闭当前 WebSocket 连接并释放网络句柄。',
          insertText: 'WS_关闭()',
          returnType: '空'
        }
      ],
      types: [
        { name: 'WebSocket连接', description: '当前窗口持有的一条 WebSocket 客户端连接。', cppType: 'HINTERNET' }
      ],
      snippets: [
        {
          label: 'WebSocket 回显测试',
          insertText: 'WS_连接("wss://echo.websocket.events")\nWS_发送文本("来自 LingBuilder 的消息")\nWS_接收到调试输出()\nWS_关闭()',
          description: '连接回显服务、发送文本、接收一条回复并关闭连接。'
        }
      ]
    },
    targets: [
      {
        id: 'windows-msvc-win32',
        platform: 'windows',
        arch: 'win32',
        toolchain: 'msvc',
        libs: ['winhttp.lib'],
        defines: ['LINGBUILDER_WEBSOCKET_CLIENT_MODULE']
      }
    ],
    bindings: {
      commands: [
        {
          command: 'WS_连接',
          runtimeName: 'WS_连接',
          parameters: [{ name: '地址', type: 'wideString' }],
          returnType: 'int',
          encoding: 'wide',
          example: 'WS_连接("wss://echo.websocket.events")'
        },
        {
          command: 'WS_发送文本',
          runtimeName: 'WS_发送文本',
          parameters: [{ name: '内容', type: 'wideString' }],
          returnType: 'int',
          encoding: 'wide',
          example: 'WS_发送文本("你好")'
        },
        {
          command: 'WS_接收到调试输出',
          runtimeName: 'WS_接收到调试输出',
          parameters: [],
          returnType: 'int',
          example: 'WS_接收到调试输出()'
        },
        {
          command: 'WS_接收文本',
          runtimeName: 'WS_接收文本',
          parameters: [],
          returnType: 'wideString',
          encoding: 'wide',
          example: 'WS_接收文本()'
        },
        {
          command: 'WS_关闭',
          runtimeName: 'WS_关闭',
          parameters: [],
          returnType: 'void',
          example: 'WS_关闭()'
        }
      ]
    }
  },
  {
    schemaVersion: 2,
    id: 'lingbuilder.http.server',
    name: 'HTTP 服务端模块',
    version: '1.0.0',
    category: '网络',
    description: '提供基于 Windows Winsock 的本地 HTTP 服务端启动、等待请求、返回文本和关闭能力。',
    author: 'LingBuilder',
    tags: ['内置', '网络', 'HTTP', '服务端'],
    contributes: {
      commands: [
        {
          name: 'HTTP_启动服务',
          signature: 'HTTP_启动服务(端口)',
          description: '在 127.0.0.1 指定端口启动单连接 HTTP 服务端，成功返回 1。',
          insertText: 'HTTP_启动服务(8080)',
          returnType: '整数型'
        },
        {
          name: 'HTTP_等待请求',
          signature: 'HTTP_等待请求()',
          description: '等待并读取一个 HTTP 请求头，返回最近请求文本。',
          insertText: 'HTTP_等待请求()',
          returnType: '文本型'
        },
        {
          name: 'HTTP_等待请求到调试输出',
          signature: 'HTTP_等待请求到调试输出()',
          description: '等待一个 HTTP 请求并把请求头写入调试输出。',
          insertText: 'HTTP_等待请求到调试输出()',
          returnType: '整数型'
        },
        {
          name: 'HTTP_回复文本',
          signature: 'HTTP_回复文本(内容)',
          description: '向当前 HTTP 请求返回 UTF-8 文本响应，并关闭该请求连接。',
          insertText: 'HTTP_回复文本("$1")',
          returnType: '整数型'
        },
        {
          name: 'HTTP_关闭服务',
          signature: 'HTTP_关闭服务()',
          description: '关闭当前 HTTP 服务端监听和请求连接。',
          insertText: 'HTTP_关闭服务()',
          returnType: '空'
        }
      ],
      types: [
        { name: 'HTTP服务端', description: '当前窗口持有的本地 HTTP 服务端监听。', cppType: 'SOCKET' }
      ],
      snippets: [
        {
          label: 'HTTP 本地文本服务',
          insertText: 'HTTP_启动服务(8080)\nHTTP_等待请求到调试输出()\nHTTP_回复文本("来自 LingBuilder 的 HTTP 响应")\nHTTP_关闭服务()',
          description: '启动本地 HTTP 服务，等待一次请求并返回中文文本。'
        }
      ]
    },
    targets: [
      {
        id: 'windows-msvc-win32',
        platform: 'windows',
        arch: 'win32',
        toolchain: 'msvc',
        libs: ['ws2_32.lib'],
        defines: ['LINGBUILDER_HTTP_SERVER_MODULE']
      }
    ],
    bindings: {
      commands: [
        {
          command: 'HTTP_启动服务',
          runtimeName: 'HTTP_启动服务',
          parameters: [{ name: '端口', type: 'int' }],
          returnType: 'int',
          example: 'HTTP_启动服务(8080)'
        },
        {
          command: 'HTTP_等待请求',
          runtimeName: 'HTTP_等待请求',
          parameters: [],
          returnType: 'wideString',
          encoding: 'wide',
          example: 'HTTP_等待请求()'
        },
        {
          command: 'HTTP_等待请求到调试输出',
          runtimeName: 'HTTP_等待请求到调试输出',
          parameters: [],
          returnType: 'int',
          example: 'HTTP_等待请求到调试输出()'
        },
        {
          command: 'HTTP_回复文本',
          runtimeName: 'HTTP_回复文本',
          parameters: [{ name: '内容', type: 'wideString' }],
          returnType: 'int',
          encoding: 'wide',
          example: 'HTTP_回复文本("你好")'
        },
        {
          command: 'HTTP_关闭服务',
          runtimeName: 'HTTP_关闭服务',
          parameters: [],
          returnType: 'void',
          example: 'HTTP_关闭服务()'
        }
      ]
    }
  },
  {
    schemaVersion: 2,
    id: 'lingbuilder.websocket.server',
    name: 'WebSocket 服务端模块',
    version: '1.0.0',
    category: '网络',
    description: '提供基于 Windows Winsock 的本地 WebSocket 服务端监听、握手、收发文本和关闭能力。',
    author: 'LingBuilder',
    tags: ['内置', '网络', 'WebSocket', '服务端'],
    contributes: {
      commands: [
        {
          name: 'WSS_启动服务',
          signature: 'WSS_启动服务(端口)',
          description: '在 127.0.0.1 指定端口启动单连接 WebSocket 服务端，成功返回 1。',
          insertText: 'WSS_启动服务(18080)',
          returnType: '整数型'
        },
        {
          name: 'WSS_等待连接',
          signature: 'WSS_等待连接()',
          description: '等待一个 WebSocket 客户端连接并完成标准握手。',
          insertText: 'WSS_等待连接()',
          returnType: '整数型'
        },
        {
          name: 'WSS_接收文本',
          signature: 'WSS_接收文本()',
          description: '从当前 WebSocket 客户端接收一条 UTF-8 文本消息。',
          insertText: 'WSS_接收文本()',
          returnType: '文本型'
        },
        {
          name: 'WSS_接收到调试输出',
          signature: 'WSS_接收到调试输出()',
          description: '接收一条 WebSocket 文本消息并写入调试输出。',
          insertText: 'WSS_接收到调试输出()',
          returnType: '整数型'
        },
        {
          name: 'WSS_发送文本',
          signature: 'WSS_发送文本(内容)',
          description: '向当前 WebSocket 客户端发送一条文本消息。',
          insertText: 'WSS_发送文本("$1")',
          returnType: '整数型'
        },
        {
          name: 'WSS_关闭服务',
          signature: 'WSS_关闭服务()',
          description: '关闭当前 WebSocket 服务端监听和客户端连接。',
          insertText: 'WSS_关闭服务()',
          returnType: '空'
        }
      ],
      types: [
        { name: 'WebSocket服务端', description: '当前窗口持有的本地 WebSocket 服务端监听。', cppType: 'SOCKET' }
      ],
      snippets: [
        {
          label: 'WebSocket 本地回显服务',
          insertText: 'WSS_启动服务(18080)\nWSS_等待连接()\nWSS_接收到调试输出()\nWSS_发送文本("来自 LingBuilder 的 WebSocket 响应")\nWSS_关闭服务()',
          description: '启动本地 WebSocket 服务，等待一个客户端连接并回复文本。'
        }
      ]
    },
    targets: [
      {
        id: 'windows-msvc-win32',
        platform: 'windows',
        arch: 'win32',
        toolchain: 'msvc',
        libs: ['ws2_32.lib', 'advapi32.lib'],
        defines: ['LINGBUILDER_WEBSOCKET_SERVER_MODULE']
      }
    ],
    bindings: {
      commands: [
        {
          command: 'WSS_启动服务',
          runtimeName: 'WSS_启动服务',
          parameters: [{ name: '端口', type: 'int' }],
          returnType: 'int',
          example: 'WSS_启动服务(18080)'
        },
        {
          command: 'WSS_等待连接',
          runtimeName: 'WSS_等待连接',
          parameters: [],
          returnType: 'int',
          example: 'WSS_等待连接()'
        },
        {
          command: 'WSS_接收文本',
          runtimeName: 'WSS_接收文本',
          parameters: [],
          returnType: 'wideString',
          encoding: 'wide',
          example: 'WSS_接收文本()'
        },
        {
          command: 'WSS_接收到调试输出',
          runtimeName: 'WSS_接收到调试输出',
          parameters: [],
          returnType: 'int',
          example: 'WSS_接收到调试输出()'
        },
        {
          command: 'WSS_发送文本',
          runtimeName: 'WSS_发送文本',
          parameters: [{ name: '内容', type: 'wideString' }],
          returnType: 'int',
          encoding: 'wide',
          example: 'WSS_发送文本("你好")'
        },
        {
          command: 'WSS_关闭服务',
          runtimeName: 'WSS_关闭服务',
          parameters: [],
          returnType: 'void',
          example: 'WSS_关闭服务()'
        }
      ]
    }
  }
];
