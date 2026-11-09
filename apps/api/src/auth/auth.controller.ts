import { Controller, HttpCode, Inject, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import { clearedSessionCookie } from './session-cookie.js';
import { Public } from './session.guard.js';

@Controller('auth')
export class AuthController {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  @Public()
  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) response: Response): void {
    response.setHeader('Set-Cookie', clearedSessionCookie(this.config.production));
  }
}
