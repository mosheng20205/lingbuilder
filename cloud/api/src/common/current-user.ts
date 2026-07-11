import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
export interface AuthenticatedUser { id: string; email: string; role?: string; mfa: boolean }
export const CurrentUser = createParamDecorator((_data, context: ExecutionContext) => context.switchToHttp().getRequest().user as AuthenticatedUser);
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
export const Public = () => SetMetadata('public', true);
