import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { getConfig } from './config.js';
import { CloudExceptionFilter } from './common/cloud-exception.filter.js';
import { AuthGuard } from './common/auth.guard.js';
import { PrismaService } from './prisma.service.js';
import { RedisService } from './redis.service.js';
import { SecretVaultService } from './security/secret-vault.service.js';
import { BillingService } from './billing/billing.service.js';
import { PromotionService } from './promotion/promotion.service.js';
import { AuthService } from './auth/auth.service.js';
import { AuthController, MeController } from './auth/auth.controller.js';
import { ProviderService } from './ai/provider.service.js';
import { AiService } from './ai/ai.service.js';
import { RulebookService } from './ai/rulebook.service.js';
import { SystemAiProviderService } from './ai/system-ai-provider.service.js';
import { AiController, UsageController } from './ai/ai.controller.js';
import { AdminController } from './admin/admin.controller.js';
import { HealthController } from './health.controller.js';
import { PaymentProviderService } from './modules/payment-provider.service.js';
import { ModuleCommerceService } from './modules/module-commerce.service.js';
import { ModuleCommerceController } from './modules/module-commerce.controller.js';
import { ModuleAdminController } from './modules/module-admin.controller.js';

@Module({
  imports: [JwtModule.register({ global: true, secret: getConfig().jwtSecret, signOptions: { issuer: 'lingbuilder-cloud', audience: 'lingbuilder-clients' }, verifyOptions: { issuer: 'lingbuilder-cloud', audience: 'lingbuilder-clients' } })],
  controllers: [HealthController, AuthController, MeController, AiController, UsageController, AdminController, ModuleCommerceController, ModuleAdminController],
  providers: [PrismaService, RedisService, SecretVaultService, BillingService, PromotionService, AuthService, ProviderService, RulebookService, SystemAiProviderService, AiService, PaymentProviderService, ModuleCommerceService, { provide: APP_GUARD, useClass: AuthGuard }, { provide: APP_FILTER, useClass: CloudExceptionFilter }]
})
export class AppModule {}
