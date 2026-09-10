import packageMetadata from '../../../package.json';

export const LINGBUILDER_PRODUCT_NAME = 'LingBuilder 中文集成开发环境';
export const LINGBUILDER_VERSION = packageMetadata.version;
export const LINGBUILDER_DISPLAY_VERSION = `v${LINGBUILDER_VERSION}`;
/** 官网地址：发现新版本时引导用户前往手动下载更新。 */
export const LINGBUILDER_OFFICIAL_SITE_URL = 'https://lingbuilder.com';

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
    version: '0.6.6',
    date: '2026-09-09',
    title: '标题栏升级徽标与更新通知修复',
    sections: [
      {
        title: '新增与改进',
        items: [
          '标题栏版本号旁新增「升级」徽标：检测到新版本时显示，鼠标悬停可直接查看该版本更新说明，点击立即进入应用内更新，无需再翻菜单。',
          'IDE 启动后会定期复查云端新版本，升级徽标保持最新状态。'
        ]
      },
      {
        title: '修复',
        items: [
          '修复新版本发布到非默认渠道（如抢先体验渠道）后，旧版 IDE 收不到更新提示的问题：现在无论 stable 还是 preview 渠道发布的版本都会正常通知。'
        ]
      }
    ]
  },
  {
    version: '0.6.5',
    date: '2026-09-05',
    title: '数组操作模块、应用内更新与教程示例工程',
    sections: [
      {
        title: '新增与改进',
        items: [
          '新增「数组操作模块」标准库：成员数、增删改查、查找、排序、倒序、重定义共 13 条中文命令，对元素类型透明，索引统一从 0 开始，越界安全返回不崩溃。',
          '代码补全与类型推导支持数组：数组下标取值、数组成员型命令的返回类型会按调用处的数组实参求解，签名提示和悬停说明同步给出元素类型。',
          '检查更新改为应用内更新对话框：可直接在 IDE 内下载、校验并安装新版本，直链或校验值缺失时自动回退为「前往官网下载」。',
          '新增 CEF3、FBro、EdgeView 教程示例工程的生成与校验脚本，配套 array-operations-demo 示例解决方案随仓库一起发布。'
        ]
      },
      {
        title: '修复',
        items: [
          '修复云端检查更新只按 sortOrder/publishedAt 取首条发布记录的问题：改为按语义化版本号取最高版本，避免后台给旧版本设置更大排序值后所有用户收不到更新。',
          '修复 DataGrid 命令目录可以声明数组类型返回值的类型漏洞，其原生 ABI 只承载标量与文本，现已在类型层面排除。'
        ]
      }
    ]
  },
  {
    version: '0.6.3',
    date: '2026-09-04',
    title: '模块生态、浏览器 API 与原生控件体验更新',
    sections: [
      {
        title: '新增与改进',
        items: [
          'EdgeView 浏览器模块补齐 271 条中文命令的完整参考与可复制示例，异步任务、Runtime 要求和安全边界说明更清晰。',
          'AI 模块导入、校验和 .lbmod 导出统一使用严格门禁，补齐文件重复、路径安全、命令绑定、文档示例和模块贡献检查；失败时不会留下半成品。',
          '管理后台登录令牌改为跨标签页安全刷新并持久化会话，降低并发刷新导致的退出和重复登录。',
          '窗口设计器新增复选框、单选框的选中填充色与选中标记色配置，布局和控件状态更容易辨认。'
        ]
      },
      {
        title: '修复',
        items: [
          '修复 Win32 原生预览和生成器中复选框、单选框未选中时显示为实心的问题。',
          '修复动态图像控件播放 GIF 时旧帧位图未稳定释放造成的 GDI/内存资源持续增长。',
          '修复 FBro SDK 安装过程中被安全软件或索引器短暂占用时的重命名失败，增加有界重试和回滚保护。',
          '修复应用内在线更新的下载、校验、取消、断点续传和安装状态衔接，更新失败时提供中文诊断和官网下载回退。'
        ]
      }
    ]
  },
  {
    version: '0.6.1',
    date: '2026-08-29',
    title: '解决方案管理与官网门户更新',
    sections: [
      {
        title: '改进',
        items: [
          '解决方案服务与侧边栏交互优化，修复项目打开和扩展服务相关问题。',
          '差异查看器与项目命名对话框细节修复。',
          '官网门户、文档中心与部署缓存策略更新，系统 AI 云端服务同步升级。'
        ]
      }
    ]
  },
  {
    version: '0.6.0',
    date: '2026-08-20',
    title: '工作台、AI 助手与设计器体验更新',
    sections: [
      {
        title: '发布',
        items: [
          '同步当前工作台、AI 助手、窗口设计器和更新检查功能改进。',
          '发布 Windows x64 离线精简安装包，严格排除 FBro、CEF3 及其关联运行时。'
        ]
      }
    ]
  },
  {
    version: '0.5.0',
    date: '2026-08-17',
    title: '当前代码更新与严格精简离线发布',
    sections: [
      {
        title: '发布',
        items: [
          '同步当前代码更新，提供 Windows x64 离线安装包。',
          '安装包严格排除 FBro、CEF3 模块目录、SDK 和关联运行时；浏览器能力需通过独立模块另行安装。'
        ]
      }
    ]
  },
  {
    version: '0.4.0',
    date: '2026-08-15',
    title: '按需 SDK、Aria2 下载与新手编辑器升级',
    sections: [
      {
        title: '新增',
        items: [
          '新增内置 Aria2 下载模块：提供受控异步下载、进度、状态、等待、停止和释放命令；F5 与 Visual Studio 导出会携带经过校验的 aria2c.exe 及 GPLv2 许可文件。',
          'CEF3 与 FBro SDK 改为首次实际需要时下载到用户共享缓存，安装包保留模块清单、校验信息和 aria2 下载器，不再携带完整 SDK。',
          '新手模式结构编辑器补齐流程折叠、嵌套缩进、声明备注、子程序管理及拼音补全交互。'
        ]
      },
      {
        title: '改进',
        items: [
          '浏览器管理器的豆包下载器改为项目资源，F5、原生导出和 .lcpppkg 共享同一资产复制与隔离规则。',
          'Windows 升级安装会清理旧版安装器遗留进程和 SDK 目录，避免“LingBuilder 无法关闭”阻断更新。'
        ]
      }
    ]
  },
  {
    version: '0.3.0',
    date: '2026-08-07',
    title: 'new_emoji FBro 浏览器外壳与可分享源码包',
    sections: [
      {
        title: '新增',
        items: [
          'new_emoji 浏览器外壳模板完整提供 Chrome 风格标签页、地址栏、菜单、弹层、窗口控制和真实 FBro x64 子宿主。',
          '新增可回读验证的一键导出入口，可生成携带设计器模型、x64 配置和 SDK 资产的 .lcpppkg 完整源码包。'
        ]
      },
      {
        title: '兼容性',
        items: [
          'new_emoji UI 2.0 与浏览器外壳模板要求 LingBuilder 0.3.0；F5、原生预览与 Visual Studio 导出继续共用同一生成和依赖物化链。'
        ]
      }
    ]
  },
  {
    version: '0.2.9',
    date: '2026-08-04',
    title: '微信多开工具与无 IDE 构建闭环',
    sections: [
      {
        title: '新增',
        items: [
          '新增微信 4.1.10.27 多开工具和受管模块，可启动多个实例并实时显示头像、wxid、昵称、进程与登录状态。',
          'Windows 原生项目统一生成并编译 EXE 图标资源，F5、AI Bridge、受控 CLI 与 Visual Studio 导出结果保持一致。',
          'LCPP 源码包可携带项目启用的第三方模块及运行时，接收方无需模块市场即可离线导入和构建。'
        ]
      },
      {
        title: '改进',
        items: [
          '无 IDE AI Bridge 工作流支持完整多文件草稿、设计器模型诊断、原生预览和受控构建，项目创建模块上下文保持一致。',
          '修复源码型模块的 nativeHandle 控件引用可见性、动态宽字符串参数和高 DPI 窗口尺寸生成。',
          '移除输出面板中未接入真实构建状态的配置选择器，构建模式与架构继续由统一配置服务管理。'
        ]
      }
    ]
  },
  {
    version: '0.2.8',
    date: '2026-08-04',
    title: '受管网络模块与 Codex 项目工作流',
    sections: [
      {
        title: '新增',
        items: [
          'HTTP 客户端升级为 74 条受管 API，支持并发请求、代理与凭据、TLS 校验、Cookie、压缩和文件传输。',
          'WebSocket 客户端和服务端分别提供 51 与 50 条受管 API，支持多连接、后台收发、二进制消息、心跳、重连和资源限制。',
          '新增 C++ Codex 配置器与 AI Bridge 项目创建工具，可在不启动 IDE 时受控创建、编辑、诊断和构建 LingBuilder 项目。'
        ]
      },
      {
        title: '改进',
        items: [
          'New_Emoji Tabs 事件参数进入模块清单、语言服务与 C++ 生成链路，处理器签名和事件变量保持一致。',
          'Windows 安装完成页直接启动安装目录中的 LingBuilder.exe，不再依赖开始菜单快捷方式。'
        ]
      }
    ]
  },
  {
    version: '0.2.7',
    date: '2026-08-02',
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
