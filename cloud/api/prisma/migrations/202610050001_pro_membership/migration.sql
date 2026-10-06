-- Pro 会员：全收费模块统一权益（299 买断 / 99 一年），支持赞助活动转入（截止 2026-11-11）。
CREATE TYPE "ProMembershipTier" AS ENUM ('PERPETUAL', 'YEARLY');
CREATE TYPE "ProMembershipSource" AS ENUM ('SPONSOR_ACTIVITY', 'PURCHASE', 'COMPENSATION');

CREATE TABLE "ProMembership" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tier" "ProMembershipTier" NOT NULL,
  "source" "ProMembershipSource" NOT NULL,
  "sponsorQq" TEXT NOT NULL DEFAULT '',
  "paidMinor" INTEGER NOT NULL DEFAULT 0,
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "note" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProMembership_userId_key" ON "ProMembership"("userId");
CREATE INDEX "ProMembership_tier_idx" ON "ProMembership"("tier");

ALTER TABLE "ProMembership" ADD CONSTRAINT "ProMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
