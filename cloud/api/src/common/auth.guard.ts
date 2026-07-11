import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly jwt: JwtService, private readonly prisma: PrismaService) {}
  async canActivate(context: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>('public', [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest(); const header = String(request.headers.authorization || '');
    const token = /^Bearer\s+(.+)$/iu.exec(header)?.[1]; if (!token) throw new UnauthorizedException('缺少登录令牌。');
    try {
      const payload = await this.jwt.verifyAsync(token); const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, include: { adminMembership: true } });
      if (!user || user.status !== 'ACTIVE') throw new Error();
      request.user = { id: user.id, email: user.email, role: user.adminMembership?.role?.toLowerCase(), mfa: Boolean(payload.mfa) };
      const roles = this.reflector.getAllAndOverride<string[]>('roles', [context.getHandler(), context.getClass()]);
      if (roles?.length && (!request.user.mfa || !roles.includes(request.user.role))) throw Object.assign(new Error('当前管理员角色无权执行该操作，或尚未完成 MFA。'), { status: 403, code: 'FORBIDDEN' });
      return true;
    } catch (error: any) { if (error?.status === 403) throw error; throw new UnauthorizedException('登录令牌无效或已过期。'); }
  }
}
