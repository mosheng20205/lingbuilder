-- AlterEnum: LedgerKind 增加充值账本类型
ALTER TYPE "LedgerKind" ADD VALUE 'RECHARGE';

-- CreateEnum: 充值订单状态
CREATE TYPE "RechargeStatus" AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'CANCELLED', 'REFUNDED');

-- CreateTable: 点数充值订单
CREATE TABLE "CreditRechargeOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "provider" "ModulePaymentProvider" NOT NULL,
    "providerOrderId" TEXT,
    "status" "RechargeStatus" NOT NULL DEFAULT 'PENDING',
    "amountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "points" BIGINT NOT NULL,
    "packageName" TEXT NOT NULL,
    "paymentUrl" TEXT,
    "paidAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditRechargeOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditRechargeOrder_userId_idempotencyKey_key" ON "CreditRechargeOrder"("userId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "CreditRechargeOrder_userId_createdAt_idx" ON "CreditRechargeOrder"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "CreditRechargeOrder" ADD CONSTRAINT "CreditRechargeOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
