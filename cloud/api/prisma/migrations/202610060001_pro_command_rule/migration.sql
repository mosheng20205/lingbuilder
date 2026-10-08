-- Pro 专享命令远程开关：管理后台按模块+命令维护，公开端点按模块分组下发。
CREATE TABLE "ProCommandRule" (
  "id" TEXT NOT NULL,
  "moduleId" TEXT NOT NULL,
  "commandName" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "note" TEXT NOT NULL DEFAULT '',
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProCommandRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProCommandRule_moduleId_commandName_key" ON "ProCommandRule"("moduleId", "commandName");
CREATE INDEX "ProCommandRule_enabled_idx" ON "ProCommandRule"("enabled");
