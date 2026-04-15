import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../user/schemas/user.schema';
import { CODE_EXCHANGER } from './code-exchanger';
import type { CodeExchanger } from './code-exchanger';

export type LoginPayload = string | { code?: string; anonymousCode?: string };

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(CODE_EXCHANGER) private readonly codeExchanger: CodeExchanger,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  async login(loginPayload: LoginPayload): Promise<User> {
    const normalized =
      typeof loginPayload === 'string'
        ? { code: loginPayload }
        : loginPayload;

    this.logger.log(
      `[login] begin hasCode=${!!normalized.code}, hasAnonymousCode=${!!normalized.anonymousCode}`,
    );

    const code = normalized.code?.trim();
    const anonymousCode = normalized.anonymousCode?.trim();
    if (!code && !anonymousCode) {
      this.logger.warn('[login] missing code and anonymousCode');
      throw new UnauthorizedException('Login failed: code/anonymousCode are both empty');
    }

    const exchangeInput = code || anonymousCode!;
    const { openid } = await this.codeExchanger.exchange(exchangeInput);
    const openId = openid;
    this.logger.log(`[login] resolved openId=${this.mask(openId)}`);

    let user = await this.userModel.findOne({ openId });
    if (!user) {
      this.logger.log(`[login] user not found, creating new user openId=${this.mask(openId)}`);
      user = await this.userModel.create({ openId });
    } else {
      this.logger.log(`[login] existing user found openId=${this.mask(openId)}`);
    }
    return user;
  }

  private mask(v: string): string {
    if (!v) return '';
    if (v.length <= 8) return `${v.slice(0, 2)}***`;
    return `${v.slice(0, 4)}***${v.slice(-4)}`;
  }
}
