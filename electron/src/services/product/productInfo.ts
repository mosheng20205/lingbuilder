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
