import { Controller, Post, Body, Req, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('api/auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      'unknown';
    const ua = req.headers['user-agent'] || 'unknown';
    this.logger.log(
      `[login] request received ip=${ip}, hasCode=${!!dto.code}, hasAnonymousCode=${!!dto.anonymousCode}, ua=${ua}`,
    );

    const user = await this.authService.login({
      code: dto.code,
      anonymousCode: dto.anonymousCode,
    });
    const openId = user?.openId ?? '';
    const masked = openId.length > 8 ? `${openId.slice(0, 4)}***${openId.slice(-4)}` : `${openId.slice(0, 2)}***`;
    this.logger.log(`[login] success openId=${masked || 'unknown'}`);
    return { code: 0, data: user };
  }
}
