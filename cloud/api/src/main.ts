import 'reflect-metadata';
import crypto from 'node:crypto';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { getConfig } from './config.js';

async function bootstrap() {
  const config = getConfig(); const app = await NestFactory.create(AppModule, { bodyParser: true, rawBody: true });
  app.enableCors({ origin: config.adminOrigin, credentials: true, allowedHeaders: ['authorization', 'content-type', 'idempotency-key', 'x-request-id', 'x-payment-signature'] });
  app.use((req: any, res: any, next: any) => { const requestId = String(req.headers['x-request-id'] || crypto.randomUUID()); req.headers['x-request-id'] = requestId; res.setHeader('x-request-id', requestId); res.setHeader('x-content-type-options', 'nosniff'); res.setHeader('referrer-policy', 'no-referrer'); next(); });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  const document = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('LingBuilder Cloud API').setVersion('1').addBearerAuth().build()); SwaggerModule.setup('docs', app, document);
  await app.listen(config.port, config.host); console.log(JSON.stringify({ service: 'LingBuilder Cloud API', origin: `http://${config.host}:${config.port}` }));
}
void bootstrap();
