import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../user/schemas/user.schema';
import { CODE_EXCHANGER } from './code-exchanger';
import type { CodeExchanger } from './code-exchanger';

export type LoginPayload = { code?: string; anonymousCode?: string };

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(CODE_EXCHANGER) private readonly codeExchanger: CodeExchanger,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  async login(dto: LoginPayload): Promise<User> {
    this.logger.log(
      `[login] begin hasCode=${!!dto.code}, hasAnonymousCode=${!!dto.anonymousCode}`,
    );

    const code = dto.code?.trim();
    const anonymousCode = dto.anonymousCode?.trim();
    if (!code && !anonymousCode) {
      this.logger.warn('[login] missing code and anonymousCode');
      throw new UnauthorizedException('Login failed: code/anonymousCode are both empty');
    }

    const exchangeInput = code ?? anonymousCode!;
    const { openid } = await this.codeExchanger.exchange(exchangeInput);
    const openId = openid;
    this.logger.log(`[login] resolved openId=${this.mask(openId)}`);

    const user = await this.userModel.findOneAndUpdate(
      { openId },
      {
        $setOnInsert: {
          openId,
          catCoins: 0,
          currentRound: 1,
          highScore: 0,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    this.logger.log(`[login] upserted user openId=${this.mask(openId)}`);
    return user;
  }

  private mask(v: string): string {
    if (!v) return '';
    if (v.length <= 8) return `${v.slice(0, 2)}***`;
    return `${v.slice(0, 4)}***${v.slice(-4)}`;
  }
}
