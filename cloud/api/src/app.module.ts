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
import { PaymentsController } from './modules/payments.controller.js';
import { ModuleAdminController } from './modules/module-admin.controller.js';
import { WebsiteContentAdminController, WebsiteContentController } from './website/website-content.controller.js';
import { WebsiteContentService } from './website/website-content.service.js';
import { BetaProgramAdminController, BetaProgramController } from './beta-program/beta-program.controller.js';
import { BetaProgramService } from './beta-program/beta-program.service.js';
import { SdkCatalogAdminController, SdkCatalogController } from './website/sdk-catalog.controller.js';
import { SdkCatalogService } from './website/sdk-catalog.service.js';
import { SkillCatalogAdminController, SkillCatalogController } from './website/skill-catalog.controller.js';
import { SkillCatalogService } from './website/skill-catalog.service.js';
import { ModuleArtifactService } from './modules/module-artifact.service.js';
import { CreditRechargeService } from './billing/credit-recharge.service.js';
import { CreditRechargeController } from './billing/credit-recharge.controller.js';

@Module({
  imports: [JwtModule.register({ global: true, secret: getConfig().jwtSecret, signOptions: { issuer: 'lingbuilder-cloud', audience: 'lingbuilder-clients' }, verifyOptions: { issuer: 'lingbuilder-cloud', audience: 'lingbuilder-clients' } })],
  controllers: [HealthController, AuthController, MeController, AiController, UsageController, AdminController, ModuleCommerceController, PaymentsController, CreditRechargeController, ModuleAdminController, WebsiteContentController, WebsiteContentAdminController, SdkCatalogController, SdkCatalogAdminController, SkillCatalogController, SkillCatalogAdminController, BetaProgramController, BetaProgramAdminController],
  providers: [PrismaService, RedisService, SecretVaultService, BillingService, PromotionService, AuthService, ProviderService, RulebookService, SystemAiProviderService, AiService, PaymentProviderService, ModuleCommerceService, ModuleArtifactService, WebsiteContentService, SdkCatalogService, SkillCatalogService, CreditRechargeService, BetaProgramService, { provide: APP_GUARD, useClass: AuthGuard }, { provide: APP_FILTER, useClass: CloudExceptionFilter }]
})
export class AppModule {}
