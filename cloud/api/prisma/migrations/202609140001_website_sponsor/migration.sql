-- 官网赞助列表：赞助人 QQ 号与金额（以分存储），按赞助时间先后公开展示。
CREATE TABLE "WebsiteSponsor" (
  "id" TEXT NOT NULL,
  "qqNumber" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "sponsoredAt" TIMESTAMP(3) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WebsiteSponsor_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WebsiteSponsor_enabled_sponsoredAt_idx" ON "WebsiteSponsor"("enabled", "sponsoredAt");
