import { LingBuilderModuleManifest } from './types';

export const BUILTIN_MODULES: LingBuilderModuleManifest[] = [
  {
    schemaVersion: 1,
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
          returnType: '整数型',
          cppRuntimeName: '信息框'
        },
        {
          name: '调试输出',
          signature: '调试输出(内容)',
          description: '向调试输出窗口和控制台输出文本。',
          insertText: '调试输出("$1")',
          returnType: '空',
          cppRuntimeName: '调试输出'
        },
        {
          name: '结束',
          signature: '结束()',
          description: '关闭当前窗口。',
          insertText: '结束()',
          returnType: '空',
          cppRuntimeName: '结束'
        }
      ],
      types: [
        { name: '窗口', description: 'Win32 窗口基类。', cppType: 'LingWindowBase' },
        { name: '按钮', description: 'Win32 按钮控件。', cppType: 'BUTTON' },
        { name: '编辑框', description: 'Win32 编辑框控件。', cppType: 'EDIT' },
        { name: '标签', description: 'Win32 静态文本控件。', cppType: 'STATIC' }
      ],
      designerControls: [
        {
          type: 'Button',
          label: '按钮',
          defaultProps: { content: '按钮', width: 120, height: 32 },
          events: [{ name: 'Click', label: '被单击', handlerPattern: '_{controlName}_被单击' }]
        },
        {
          type: 'TextBox',
          label: '编辑框',
          defaultProps: { content: '', width: 160, height: 32 },
          events: [{ name: 'Change', label: '内容被改变', handlerPattern: '_{controlName}_内容被改变' }]
        }
      ],
      cpp: {
        libs: ['comctl32.lib'],
        defines: ['UNICODE', '_UNICODE']
      }
    }
  }
];
