CREATE TYPE "ModuleOfferKind" AS ENUM ('PERPETUAL', 'FIXED_TERM');
CREATE TYPE "ModuleOrderStatus" AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'CANCELLED', 'REFUNDED');
CREATE TYPE "ModulePaymentProvider" AS ENUM ('WECHAT', 'ALIPAY', 'MANUAL');
CREATE TYPE "ModuleEntitlementSource" AS ENUM ('PURCHASE', 'ADMIN_GRANT', 'COMPENSATION');

CREATE TABLE "ModuleProduct" (
  "id" TEXT NOT NULL,
  "moduleId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "listed" BOOLEAN NOT NULL DEFAULT false,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "policyVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ModuleProduct_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModuleOffer" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" "ModuleOfferKind" NOT NULL,
  "priceMinor" BIGINT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'CNY',
  "durationDays" INTEGER,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ModuleOffer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModuleOrder" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "offerId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "provider" "ModulePaymentProvider" NOT NULL,
  "providerOrderId" TEXT,
  "status" "ModuleOrderStatus" NOT NULL DEFAULT 'PENDING',
  "amountMinor" BIGINT NOT NULL,
  "currency" TEXT NOT NULL,
  "offerKind" "ModuleOfferKind" NOT NULL,
  "durationDays" INTEGER,
  "paymentUrl" TEXT,
  "paidAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "refundedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ModuleOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModuleEntitlement" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "orderId" TEXT,
  "source" "ModuleEntitlementSource" NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "reason" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ModuleEntitlement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModuleFreeWindow" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ModuleFreeWindow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentWebhookEvent" (
  "id" TEXT NOT NULL,
  "provider" "ModulePaymentProvider" NOT NULL,
  "eventId" TEXT NOT NULL,
  "orderId" TEXT,
  "eventType" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModuleAccessAudit" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "moduleId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "allowed" BOOLEAN NOT NULL,
  "source" TEXT,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModuleAccessAudit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ModuleProduct_moduleId_key" ON "ModuleProduct"("moduleId");
CREATE INDEX "ModuleOffer_productId_enabled_idx" ON "ModuleOffer"("productId", "enabled");
CREATE UNIQUE INDEX "ModuleOrder_userId_idempotencyKey_key" ON "ModuleOrder"("userId", "idempotencyKey");
CREATE UNIQUE INDEX "ModuleOrder_provider_providerOrderId_key" ON "ModuleOrder"("provider", "providerOrderId");
CREATE INDEX "ModuleOrder_userId_createdAt_idx" ON "ModuleOrder"("userId", "createdAt");
CREATE UNIQUE INDEX "ModuleEntitlement_orderId_key" ON "ModuleEntitlement"("orderId");
CREATE INDEX "ModuleEntitlement_userId_productId_startsAt_endsAt_idx" ON "ModuleEntitlement"("userId", "productId", "startsAt", "endsAt");
CREATE INDEX "ModuleFreeWindow_productId_enabled_startsAt_endsAt_idx" ON "ModuleFreeWindow"("productId", "enabled", "startsAt", "endsAt");
CREATE UNIQUE INDEX "PaymentWebhookEvent_provider_eventId_key" ON "PaymentWebhookEvent"("provider", "eventId");
CREATE INDEX "ModuleAccessAudit_userId_moduleId_createdAt_idx" ON "ModuleAccessAudit"("userId", "moduleId", "createdAt");

ALTER TABLE "ModuleOffer" ADD CONSTRAINT "ModuleOffer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ModuleProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModuleOrder" ADD CONSTRAINT "ModuleOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModuleOrder" ADD CONSTRAINT "ModuleOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ModuleProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ModuleOrder" ADD CONSTRAINT "ModuleOrder_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "ModuleOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ModuleEntitlement" ADD CONSTRAINT "ModuleEntitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModuleEntitlement" ADD CONSTRAINT "ModuleEntitlement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ModuleProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModuleEntitlement" ADD CONSTRAINT "ModuleEntitlement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ModuleOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ModuleFreeWindow" ADD CONSTRAINT "ModuleFreeWindow_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ModuleProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModuleAccessAudit" ADD CONSTRAINT "ModuleAccessAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModuleAccessAudit" ADD CONSTRAINT "ModuleAccessAudit_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ModuleProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ModuleProduct" ("id", "moduleId", "name", "description", "listed", "enabled", "policyVersion", "createdAt", "updatedAt")
VALUES ('f6bcfd9f-31ef-4bb9-9fa6-5d7a96cd268f', 'lingbuilder.new_emoji.ui', 'new_emoji 原生界面库', 'LingBuilder 高级原生 UI 模块', true, true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("moduleId") DO NOTHING;
