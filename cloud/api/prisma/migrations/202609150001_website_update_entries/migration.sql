-- 官网「更新记录」页：按日期一条记录，条目以 JSON 数组文本存储，由同步脚本整量维护。
CREATE TABLE "WebsiteUpdateEntry" (
  "id" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "itemsJson" TEXT NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WebsiteUpdateEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebsiteUpdateEntry_date_key" ON "WebsiteUpdateEntry"("date");
