import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  Inject,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import type { Principal } from './principal.js';
import { authenticate } from './session-cookie.js';

const principals = new WeakMap<Request, Principal>();

const PUBLIC_ROUTE = Symbol('PUBLIC_ROUTE');

/** Opts a handler out of the global session guard. Every route is authenticated unless it says otherwise. */
export const Public = () => SetMetadata(PUBLIC_ROUTE, true);

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const session = await authenticate(request.headers.cookie, this.config.jwtSecret);
    if (!session) throw new UnauthorizedException();
    principals.set(request, session.principal);
    return true;
  }
}

export const CurrentPrincipal = createParamDecorator((_: unknown, context: ExecutionContext) => {
  const principal = principals.get(context.switchToHttp().getRequest<Request>());
  if (!principal) throw new UnauthorizedException();
  return principal;
});
