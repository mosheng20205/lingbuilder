import 'reflect-metadata';
import crypto from 'node:crypto';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { getConfig } from './config.js';

async function bootstrap() {
  const config = getConfig(); const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: true, rawBody: true });
  // 生产链路只有本机宝塔 nginx → docker 桥一跳；仅信任回环/私网代理，@Ip() 才能取到真实客户端且公网伪造 XFF 不生效。
  app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);
  app.useBodyParser('json', { limit: '5mb' });
  app.enableCors({ origin: (requestOrigin, callback) => {
    if (!requestOrigin || config.corsOrigins.includes(requestOrigin)) return callback(null, true);
    return callback(new Error('请求来源未被允许。'), false);
  }, credentials: true, allowedHeaders: ['authorization', 'content-type', 'idempotency-key', 'x-request-id', 'x-module-arch', 'x-module-file-name', 'x-minimum-ide-version'] });
  app.use((req: any, res: any, next: any) => { const requestId = String(req.headers['x-request-id'] || crypto.randomUUID()); req.headers['x-request-id'] = requestId; res.setHeader('x-request-id', requestId); res.setHeader('x-content-type-options', 'nosniff'); res.setHeader('referrer-policy', 'no-referrer'); next(); });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  const document = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('LingBuilder Cloud API').setVersion('1').addBearerAuth().build()); SwaggerModule.setup('docs', app, document);
  await app.listen(config.port, config.host); console.log(JSON.stringify({ service: 'LingBuilder Cloud API', origin: `http://${config.host}:${config.port}` }));
}
void bootstrap();
