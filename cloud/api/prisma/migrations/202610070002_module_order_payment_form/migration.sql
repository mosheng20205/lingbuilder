-- 模块订单存储支付宝 page 模式的收银台表单（pay-page 双查找渲染用）。
ALTER TABLE "ModuleOrder" ADD COLUMN "paymentForm" TEXT;
