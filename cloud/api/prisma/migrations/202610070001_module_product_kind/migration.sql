-- 商品种类：module＝收费模块；membership＝Pro 会员会籍（支付回调建/续会籍）。
CREATE TYPE "ModuleProductKind" AS ENUM ('MODULE', 'MEMBERSHIP');
ALTER TABLE "ModuleProduct" ADD COLUMN "kind" "ModuleProductKind" NOT NULL DEFAULT 'MODULE';
