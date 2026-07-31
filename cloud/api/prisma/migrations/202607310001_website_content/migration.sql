CREATE TABLE "WebsiteDownloadRelease" (
  "id" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'stable',
  "platform" TEXT NOT NULL DEFAULT 'Windows',
  "architecture" TEXT NOT NULL DEFAULT 'x64',
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL DEFAULT '',
  "releaseNotes" TEXT NOT NULL DEFAULT '',
  "minimumRequirements" TEXT NOT NULL DEFAULT '',
  "fileSize" TEXT NOT NULL DEFAULT '',
  "sha256" TEXT NOT NULL DEFAULT '',
  "publicationStatus" TEXT NOT NULL DEFAULT 'DRAFT',
  "publishedAt" TIMESTAMP(3),
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WebsiteDownloadRelease_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebsiteDownloadMirror" (
  "id" TEXT NOT NULL,
  "releaseId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "accessCode" TEXT NOT NULL DEFAULT '',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WebsiteDownloadMirror_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebsiteCommandReference" (
  "id" TEXT NOT NULL,
  "stableKey" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "summary" TEXT NOT NULL DEFAULT '',
  "kind" TEXT NOT NULL DEFAULT 'COMMAND',
  "category" TEXT NOT NULL DEFAULT '其他',
  "moduleId" TEXT,
  "moduleName" TEXT,
  "signature" TEXT NOT NULL,
  "returnType" TEXT NOT NULL DEFAULT 'void',
  "returnDescription" TEXT NOT NULL DEFAULT '',
  "parameters" JSONB NOT NULL,
  "examples" JSONB NOT NULL,
  "supportedBackends" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "minimumVersion" TEXT NOT NULL DEFAULT '',
  "lifecycle" TEXT NOT NULL DEFAULT 'AVAILABLE',
  "source" TEXT NOT NULL DEFAULT 'manual',
  "sourceVersion" TEXT NOT NULL DEFAULT '',
  "publicationStatus" TEXT NOT NULL DEFAULT 'DRAFT',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WebsiteCommandReference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebsiteGuideArticle" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL DEFAULT '',
  "kind" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT '',
  "bodyMarkdown" TEXT NOT NULL,
  "coverImageUrl" TEXT NOT NULL DEFAULT '',
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "minimumVersion" TEXT NOT NULL DEFAULT '',
  "publicationStatus" TEXT NOT NULL DEFAULT 'DRAFT',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WebsiteGuideArticle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebsiteDemoProject" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "difficulty" TEXT NOT NULL DEFAULT '入门',
  "lingBuilderVersion" TEXT NOT NULL DEFAULT '',
  "modules" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "prerequisites" TEXT NOT NULL DEFAULT '',
  "sourceLinks" JSONB NOT NULL,
  "screenshotUrl" TEXT NOT NULL DEFAULT '',
  "videoUrl" TEXT NOT NULL DEFAULT '',
  "license" TEXT NOT NULL DEFAULT '',
  "publicationStatus" TEXT NOT NULL DEFAULT 'DRAFT',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WebsiteDemoProject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebsiteCommunityGroup" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "qqNumber" TEXT NOT NULL,
  "groupType" TEXT NOT NULL DEFAULT '官方交流群',
  "joinUrl" TEXT NOT NULL DEFAULT '',
  "qrCodeUrl" TEXT NOT NULL DEFAULT '',
  "description" TEXT NOT NULL DEFAULT '',
  "statusText" TEXT NOT NULL DEFAULT '开放加入',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WebsiteCommunityGroup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebsiteDownloadRelease_version_channel_platform_architecture_key" ON "WebsiteDownloadRelease"("version", "channel", "platform", "architecture");
CREATE INDEX "WebsiteDownloadRelease_publicationStatus_sortOrder_publishedAt_idx" ON "WebsiteDownloadRelease"("publicationStatus", "sortOrder", "publishedAt");
CREATE UNIQUE INDEX "WebsiteDownloadMirror_releaseId_provider_key" ON "WebsiteDownloadMirror"("releaseId", "provider");
CREATE INDEX "WebsiteDownloadMirror_releaseId_enabled_sortOrder_idx" ON "WebsiteDownloadMirror"("releaseId", "enabled", "sortOrder");
CREATE UNIQUE INDEX "WebsiteCommandReference_stableKey_key" ON "WebsiteCommandReference"("stableKey");
CREATE INDEX "WebsiteCommandReference_publicationStatus_kind_category_idx" ON "WebsiteCommandReference"("publicationStatus", "kind", "category");
CREATE INDEX "WebsiteCommandReference_moduleId_lifecycle_idx" ON "WebsiteCommandReference"("moduleId", "lifecycle");
CREATE INDEX "WebsiteCommandReference_name_idx" ON "WebsiteCommandReference"("name");
CREATE UNIQUE INDEX "WebsiteGuideArticle_slug_key" ON "WebsiteGuideArticle"("slug");
CREATE INDEX "WebsiteGuideArticle_kind_publicationStatus_sortOrder_idx" ON "WebsiteGuideArticle"("kind", "publicationStatus", "sortOrder");
CREATE UNIQUE INDEX "WebsiteDemoProject_slug_key" ON "WebsiteDemoProject"("slug");
CREATE INDEX "WebsiteDemoProject_publicationStatus_category_sortOrder_idx" ON "WebsiteDemoProject"("publicationStatus", "category", "sortOrder");
CREATE UNIQUE INDEX "WebsiteCommunityGroup_qqNumber_key" ON "WebsiteCommunityGroup"("qqNumber");
CREATE INDEX "WebsiteCommunityGroup_enabled_sortOrder_idx" ON "WebsiteCommunityGroup"("enabled", "sortOrder");

ALTER TABLE "WebsiteDownloadMirror" ADD CONSTRAINT "WebsiteDownloadMirror_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "WebsiteDownloadRelease"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "WebsiteDownloadRelease" ("id", "version", "channel", "platform", "architecture", "title", "summary", "releaseNotes", "minimumRequirements", "publicationStatus", "publishedAt", "sortOrder", "updatedAt") VALUES
('00000000-0000-4000-8000-000000000001', '0.2.0', 'preview', 'Windows', 'x64', 'LingBuilder 中文集成开发环境', '体验中文源码、可视化设计器、真实 C++ 生成和 AI 辅助。', '当前版本仍在持续开发与测试中。', 'Windows 10/11；高级构建能力需要 Visual Studio Build Tools 与 Windows SDK。', 'PUBLISHED', CURRENT_TIMESTAMP, 100, CURRENT_TIMESTAMP);

INSERT INTO "WebsiteDownloadMirror" ("id", "releaseId", "provider", "label", "url", "accessCode", "sortOrder", "updatedAt") VALUES
('00000000-0000-4000-8100-000000000001', '00000000-0000-4000-8000-000000000001', '123pan', '123 云盘', 'https://1855765585.share.123pan.cn/123pan/jgROvd-lPcW', '', 10, CURRENT_TIMESTAMP),
('00000000-0000-4000-8100-000000000002', '00000000-0000-4000-8000-000000000001', '189cloud', '天翼云盘', 'https://cloud.189.cn/web/share?code=7rEZniR7r2u2', 'xi65', 20, CURRENT_TIMESTAMP),
('00000000-0000-4000-8100-000000000003', '00000000-0000-4000-8000-000000000001', 'baidu', '百度网盘', 'https://pan.baidu.com/s/13ApwWnvg7ypC8RkALtnwqg?pwd=z25w', 'z25w', 30, CURRENT_TIMESTAMP),
('00000000-0000-4000-8100-000000000004', '00000000-0000-4000-8000-000000000001', 'xunlei', '迅雷云盘', 'https://pan.xunlei.com/s/VOyNJe3jycYK-6GzlUFxXApqA1?pwd=emuk', 'emuk', 40, CURRENT_TIMESTAMP);

INSERT INTO "WebsiteCommunityGroup" ("id", "name", "qqNumber", "description", "sortOrder", "updatedAt") VALUES
('00000000-0000-4000-8200-000000000001', 'LingBuilder 官方 QQ 交流群', '1083244094', '交流 IDE 使用、中文编程、模块封装和问题反馈。', 100, CURRENT_TIMESTAMP);

INSERT INTO "WebsiteGuideArticle" ("id", "slug", "title", "summary", "kind", "category", "bodyMarkdown", "tags", "publicationStatus", "sortOrder", "updatedAt") VALUES
('00000000-0000-4000-8300-000000000001', 'basic-controls', '基础控件使用手册', '窗口、按钮、标签、编辑框等基础 Win32 控件的设计器与中文代码用法。', 'CONTROL', '基础控件', E'# 基础控件\n\n基础控件由 `lingbuilder.win32.basic` 提供。把控件拖入设计器后，可在属性面板修改名称、文本、位置和状态。\n\n## 事件处理\n\n在事件面板创建处理器，IDE 会生成对应 `.子程序`。运行行为以中文代码编辑器中的事件代码为准。\n\n```lcpp\n.子程序 开始按钮_被单击\n  信息框("你好，LingBuilder！")\n结束\n```', ARRAY['Win32','基础控件','设计器'], 'PUBLISHED', 10, CURRENT_TIMESTAMP),
('00000000-0000-4000-8300-000000000002', 'advanced-controls', '高级控件使用手册', '列表视图、树形框、数据表格、浏览器和媒体控件的使用说明。', 'CONTROL', '高级控件', E'# 高级控件\n\n高级控件通常由 `lingbuilder.win32.common-controls` 或独立模块提供。使用前请在项目“模块”组中确认对应模块已经启用。\n\n## 使用原则\n\n- 先在设计器中创建控件实例。\n- 通过中文控件名调用命令。\n- 按命令资料确认模块、后端和最低版本。\n- 导出工程时一并携带模块声明的原生依赖。', ARRAY['高级控件','模块','设计器'], 'PUBLISHED', 20, CURRENT_TIMESTAMP),
('00000000-0000-4000-8300-000000000003', 'cpp-module-development', '如何封装 C++ 模块', '从 manifest v2、中文命令映射到打包和验证的完整入口。', 'MODULE', '模块开发', E'# 封装 C++ 模块\n\nLingBuilder 模块包使用 `.lbmod` 格式，根目录必须包含 v2 `lingbuilder.module.json`。\n\n## 推荐流程\n\n1. 运行 `lingbuilder module init` 创建模板。\n2. 在 `contributes.commands` 中提供中文补全、说明和签名。\n3. 在 `bindings.commands` 中提供确定性的中文命令到 C++ 运行时映射。\n4. 在 `targets[]` 中声明头文件、源码、库和运行时文件。\n5. 运行 `module validate`、`module pack` 和 `module inspect`。\n6. 安装前通过模块包预览检查内容。\n\n模块不得向渲染进程注入任意 JavaScript，也不能只增加补全而缺少真实 C++ 实现。', ARRAY['C++','lbmod','模块 SDK'], 'PUBLISHED', 10, CURRENT_TIMESTAMP),
('00000000-0000-4000-8300-000000000004', 'ai-guide', '如何使用 IDE 的 AI 功能', '代码生成、项目创建、错误修复、Diff 审查和 AI Bridge 权限说明。', 'AI', 'AI 使用', E'# 使用 LingBuilder AI\n\nAI 可以帮助生成代码、创建项目、解释构建错误和提出修复，但不会替代本地确定性编译规则。\n\n## 安全修改流程\n\n1. 描述目标并选择需要提供给 AI 的工作区内容。\n2. 让 AI 生成修改草稿。\n3. 在 Diff 中检查变更。\n4. 明确批准后应用，并保留撤销能力。\n\n## AI Bridge 权限\n\n- `readonly`：只读，禁止写入和执行。\n- `preview`：写文件、导出和构建前必须批准。\n- `yolo`：只允许执行 LingBuilder 暴露的受控工具，不开放任意 Shell。', ARRAY['AI','AI Bridge','Diff'], 'PUBLISHED', 10, CURRENT_TIMESTAMP);

INSERT INTO "WebsiteDemoProject" ("id", "slug", "title", "summary", "category", "difficulty", "lingBuilderVersion", "modules", "prerequisites", "sourceLinks", "license", "publicationStatus", "sortOrder", "updatedAt") VALUES
('00000000-0000-4000-8400-000000000001', 'basic-control-flow', '基础控制类命令 Demo', '展示基础中文控制流程、窗口事件和真实 C++ 构建请求。', '入门', '入门', '0.2.0', ARRAY['lingbuilder.win32.basic'], 'Windows 10/11；构建时需要 MSVC。', '[{"label":"查看源码目录","url":"https://gitee.com/MoSheng2020/han-code-studio/tree/main/examples/basic-control-flow-demo"}]'::jsonb, '以仓库许可证为准', 'PUBLISHED', 10, CURRENT_TIMESTAMP),
('00000000-0000-4000-8400-000000000002', 'module-cli-smoke', 'C++ 模块调用 Demo', '展示项目模块引用、中文模块命令和 AI Bridge 受控创建请求。', '模块开发', '进阶', '0.2.0', ARRAY[]::TEXT[], 'LingBuilder 模块 SDK。', '[{"label":"查看源码目录","url":"https://gitee.com/MoSheng2020/han-code-studio/tree/main/examples/module-cli-smoke"}]'::jsonb, '以仓库许可证为准', 'PUBLISHED', 20, CURRENT_TIMESTAMP);

INSERT INTO "WebsiteCommandReference" ("id", "stableKey", "name", "summary", "kind", "category", "moduleId", "moduleName", "signature", "returnType", "parameters", "examples", "supportedBackends", "minimumVersion", "source", "sourceVersion", "publicationStatus", "sortOrder", "updatedAt") VALUES
('00000000-0000-4000-8500-000000000001', 'lingbuilder.win32.basic:信息框', '信息框', '显示原生消息框。', 'COMMAND', '窗口', 'lingbuilder.win32.basic', 'Win32 基础控件', '信息框(内容, 标题, 类型)', 'int', '[{"name":"内容","type":"wideString","description":"要显示的文本"},{"name":"标题","type":"wideString","description":"窗口标题，可选"},{"name":"类型","type":"int","description":"消息框类型，可选"}]'::jsonb, '["信息框(\"你好，LingBuilder！\")"]'::jsonb, ARRAY['win32','new-emoji'], '0.2.0', 'builtin', '0.2.0', 'PUBLISHED', 10, CURRENT_TIMESTAMP),
('00000000-0000-4000-8500-000000000002', 'lingbuilder.win32.basic:调试输出', '调试输出', '向 IDE 输出面板写入中文调试文本。', 'COMMAND', '调试', 'lingbuilder.win32.basic', 'Win32 基础控件', '调试输出(内容)', 'void', '[{"name":"内容","type":"wideString","description":"输出内容"}]'::jsonb, '["调试输出(\"窗口已就绪\")"]'::jsonb, ARRAY['win32','new-emoji'], '0.2.0', 'builtin', '0.2.0', 'PUBLISHED', 20, CURRENT_TIMESTAMP);
