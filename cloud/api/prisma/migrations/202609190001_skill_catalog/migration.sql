-- 灵码 Skill 清单发布表：整条 payload 签名存储，sequence 唯一且单调递增（客户端据此防回滚）。
CREATE TABLE "SkillCatalogRelease" (
  "id" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "payload" TEXT NOT NULL,
  "keyId" TEXT NOT NULL,
  "signature" TEXT NOT NULL,
  "note" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SkillCatalogRelease_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SkillCatalogRelease_sequence_key" ON "SkillCatalogRelease"("sequence");
