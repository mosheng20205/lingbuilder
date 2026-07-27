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
