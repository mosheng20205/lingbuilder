import crypto from 'node:crypto';
import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class CloudExceptionFilter implements ExceptionFilter {
  catch(error: any, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>(); const request = host.switchToHttp().getRequest<Request>();
    const requestId = String(request.headers['x-request-id'] || crypto.randomUUID());
    const status = error instanceof HttpException ? error.getStatus() : Number(error?.status || 500);
    const code = error?.code || (status === 401 ? 'AUTH_REQUIRED' : status === 403 ? 'FORBIDDEN' : status === 429 ? 'RATE_LIMITED' : 'INTERNAL_ERROR');
    const message = status >= 500 ? '服务器暂时无法处理该请求。' : String(error?.message || '请求失败。');
    if (status >= 500) console.error(JSON.stringify({ level: 'error', requestId, method: request.method, path: request.path, code, error: String(error?.stack || error) }));
    response.status(status).json({ ok: false, code, message, requestId });
  }
}
