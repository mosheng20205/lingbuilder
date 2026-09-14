-- 体验计划（Beta Program）：名单、自助报名与全局开关键值表。
CREATE TABLE "BetaProgramMember" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "groupTag" TEXT NOT NULL DEFAULT '',
  "validUntil" TIMESTAMP(3),
  "note" TEXT NOT NULL DEFAULT '',
  "addedByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BetaProgramMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BetaProgramApplication" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "message" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "reviewedByAdminId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "rejectReason" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BetaProgramApplication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SystemFlag" (
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "updatedByAdminId" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SystemFlag_pkey" PRIMARY KEY ("key")
);

CREATE UNIQUE INDEX "BetaProgramMember_userId_key" ON "BetaProgramMember"("userId");
CREATE INDEX "BetaProgramMember_status_idx" ON "BetaProgramMember"("status");
CREATE UNIQUE INDEX "BetaProgramApplication_userId_key" ON "BetaProgramApplication"("userId");
CREATE INDEX "BetaProgramApplication_status_idx" ON "BetaProgramApplication"("status");

ALTER TABLE "BetaProgramMember" ADD CONSTRAINT "BetaProgramMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BetaProgramApplication" ADD CONSTRAINT "BetaProgramApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "SystemFlag" ("key", "value", "updatedAt") VALUES ('beta_program.preview_channel_suspended', 'false', CURRENT_TIMESTAMP);
