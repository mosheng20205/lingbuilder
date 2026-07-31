import packageMetadata from '../../../package.json';

export const LINGBUILDER_PRODUCT_NAME = 'LingBuilder 中文集成开发环境';
export const LINGBUILDER_VERSION = packageMetadata.version;
export const LINGBUILDER_DISPLAY_VERSION = `v${LINGBUILDER_VERSION}`;

export interface LingBuilderReleaseNoteSection {
  title: string;
  items: readonly string[];
}

export interface LingBuilderReleaseNote {
  version: string;
  date: string;
  title: string;
  sections: readonly LingBuilderReleaseNoteSection[];
}

export const LINGBUILDER_RELEASE_NOTES: readonly LingBuilderReleaseNote[] = [
  {
    version: '0.2.8',
    date: '2026-07-31',
    title: 'EdgeView 官方稳定 API 双基线封装',
    sections: [
      {
        title: '新增',
        items: [
          'EdgeView 1.2.0 固定 WebView2 SDK 1.0.4078.44，并以 Runtime 141/150 建立兼容与完整覆盖双基线。',
          '新增带控件 generation 和线程校验的受管对象表，以及 Frame、Worker、扩展、权限、通知和共享缓冲安全命令。',
          '设计器新增 Edge 控件独立原生预览，并补齐 User-Agent、Profile、隐私模式、语言、跟踪保护、自动填充等稳定属性。',
          '覆盖生成器不再自动把未知方法归为 internal；双基线差异、pending 和真实运行时符号均进入严格门禁。'
        ]
      },
      {
        title: '安全与兼容',
        items: [
          '异步回调使用等待、成功、失败、取消、超时五态任务；新处理器统一使用 &处理器名，旧字符串写法继续兼容并给出迁移警告。',
          '不暴露裸 COM、内存地址、任意 Host Object 或 CompositionController；二进制结果只写入显式文件路径。'
        ]
      }
    ]
  },
  {
    version: '0.2.6',
    date: '2026-07-30',
    title: '密码学模块与中文编程示例',
    sections: [
      {
        title: '新增',
        items: [
          '新增哈希、密码哈希与派生、对称加密、非对称密码四类模块，共提供 77 条中文命令。',
          '新增固定版本的 Botan 3.12.0 与 BLAKE3 1.8.5 双架构 SDK，支持模块包、依赖物化和 Visual Studio 导出。',
          '基础模块新增格式化文本，支持多类型占位符、字面花括号及安全的参数不足或多余处理。'
        ]
      },
      {
        title: '示例',
        items: [
          '新增 PopupMenu、格式化文本与完整控制流中文示例及可独立导入的源码包。',
          '密码学原生验证覆盖摘要、密码哈希、对称加密、RSA、ECDSA、SM2、ECDH、X25519 与 ElGamal。'
        ]
      }
    ]
  },
  {
    version: '0.2.5',
    date: '2026-07-30',
    title: 'Win32 数据表格',
    sections: [
      {
        title: '新增',
        items: [
          '高级控件新增独立 DataGrid，支持文本、数值、日期、选择框、Switch、图片、进度、组合框和多按钮列。',
          '数据表格提供稳定行键与列 ID、结构化设计器、TSV/CSV、排序筛选、撤销重做及非阻塞虚拟数据接口。'
        ]
      },
      {
        title: '兼容性',
        items: ['旧 New_Emoji Table 保留原后端与生成行为，仅补充统一结构化编辑模型；源码包使用 win32.datagrid.v1 能力标记。']
      }
    ]
  },
  {
    version: '0.2.4',
    date: '2026-07-30',
    title: 'ListView 能力、New_Emoji 浏览器与帮助入口',
    sections: [
      {
        title: '新增',
        items: [
          'Win32 ListView 补齐行与单元格读写、批量 TSV、排序、重绘事务及真正的虚拟列表模式。',
          'New_Emoji Tabs 支持在三个页面槽中承载独立 FBro 浏览器，并随标签切换显示状态。',
          '帮助菜单新增赞助二维码和交流 QQ 群入口，同时注册到命令系统与命令面板。'
        ]
      },
      {
        title: '改进',
        items: [
          '源码包只携带当前项目实际需要的 CEF3/FBro SDK 资产，普通项目导出体积显著降低。',
          'Visual Studio 导出会携带模块发布的全部 Windows/MSVC 目标，并修复 FBro 子宿主的 DPI、坐标与初始化流程。'
        ]
      }
    ]
  },
  {
    version: '0.2.3',
    date: '2026-07-28',
    title: 'ListView 设计器编辑稳定性',
    sections: [
      {
        title: '修复',
        items: [
          '修复 ListView 集合编辑器连续输入时被旧项目快照覆盖，导致列标题或行数据丢失的问题。',
          '修复设计器本地项目与应用项目交换新旧快照形成的状态振荡和画布文字闪烁。'
        ]
      },
      {
        title: '改进',
        items: [
          'ListView 与 Header 预览使用稳定列位置维护表头节点，修改标题时不再销毁并重建单元格。',
          '列、行、宽度、图片编号和批量粘贴内容继续实时同步到设计画布与项目模型。'
        ]
      }
    ]
  },
  {
    version: '0.2.2',
    date: '2026-07-28',
    title: '浏览器集成、解决方案管理与 Git 工作流',
    sections: [
      {
        title: '新增',
        items: [
          'FBro 与 CEF3 示例完善内嵌浏览器、谷歌原生 UI、导航工具栏和窗口自适应能力。',
          '解决方案资源管理器支持逻辑文件夹、项目拖放归组、项目重命名和侧栏宽度记忆。',
          'Git 更改面板补齐差异查看、放弃修改、仓库初始化、远程管理与 Pull Request 工作流。'
        ]
      },
      {
        title: '改进',
        items: [
          'FBro VIP Key 改为由用户自助配置并通过 Windows 安全存储保护。',
          '优化项目树层级对齐和项目名称显示，并修复多项 FBro 启动、缩放及运行时导出问题。'
        ]
      }
    ]
  },
  {
    version: '0.2.1',
    date: '2026-07-27',
    title: '版本信息与帮助体验',
    sections: [
      {
        title: '新增',
        items: [
          '工作台左上角与“关于 LingBuilder IDE”窗口现在会显示统一的软件版本号。',
          '帮助中心新增内置更新日志，无需联网即可查看当前版本变化。'
        ]
      },
      {
        title: '改进',
        items: [
          '界面版本号改为读取应用发布元数据，避免标题栏、关于窗口与安装包版本不一致。'
        ]
      }
    ]
  }
];
