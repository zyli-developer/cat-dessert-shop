import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../user/schemas/user.schema';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async login(loginPayload: { code?: string; anonymousCode?: string }): Promise<User> {
    this.logger.log(
      `[login] begin hasCode=${!!loginPayload.code}, hasAnonymousCode=${!!loginPayload.anonymousCode}`,
    );
    const openId = await this.code2Session(loginPayload);
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

  /**
   * 调用抖音 code2Session 接口，用 code 换取 openId
   * 文档: https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/develop/server/log-in/code-2-session
   *
   * 优先使用官方推荐域名 GET；失败时回退旧版 POST（developer.toutiao.com v2）。
   */
  private async code2Session(loginPayload: { code?: string; anonymousCode?: string }): Promise<string> {
    const code = loginPayload.code?.trim();
    const anonymousCode = loginPayload.anonymousCode?.trim();
    if (!code && !anonymousCode) {
      this.logger.warn('[code2Session] missing code and anonymousCode');
      throw new UnauthorizedException('Login failed: code/anonymousCode are both empty');
    }

    const appId = process.env.DOUYIN_APP_ID;
    const secret = process.env.DOUYIN_APP_SECRET;
    const appIdValue = appId?.trim();
    const secretValue = secret?.trim();

    // 强制真实登录链路：必须配置有效 AppID/Secret，禁止占位值/本地兜底
    if (this.isPlaceholderOrEmpty(appIdValue) || this.isPlaceholderOrEmpty(secretValue)) {
      this.logger.error(
        '[code2Session] DOUYIN_APP_ID/SECRET missing or placeholder. real login requires valid credentials from Douyin console.',
      );
      throw new UnauthorizedException('Login failed: DOUYIN_APP_ID/DOUYIN_APP_SECRET not configured correctly');
    }

    try {
      this.logger.log(`[code2Session] trying new GET endpoint hasCode=${!!code}, hasAnonymousCode=${!!anonymousCode}`);
      const openIdNew = await this.code2SessionNewGet(appIdValue!, secretValue!, { code, anonymousCode });
      if (openIdNew) {
        this.logger.log(`[code2Session] new GET endpoint success openId=${this.mask(openIdNew)}`);
        return openIdNew;
      }
      this.logger.warn('[code2Session] new GET endpoint returned no openId, trying legacy POST');
      const openIdLegacy = await this.code2SessionLegacyPost(appIdValue!, secretValue!, { code, anonymousCode });
      if (openIdLegacy) {
        this.logger.log(`[code2Session] legacy POST endpoint success openId=${this.mask(openIdLegacy)}`);
        return openIdLegacy;
      }
      this.logger.error('[code2Session] both endpoints returned empty openId');
      throw new UnauthorizedException('Login failed: no openId from code2Session');
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      this.logger.error('[code2Session] unexpected error', error instanceof Error ? error.stack : String(error));
      throw new UnauthorizedException('Login service unavailable');
    }
  }

  private isPlaceholderOrEmpty(v: string | undefined): boolean {
    if (!v) return true;
    const n = v.trim().toLowerCase();
    if (!n) return true;
    return (
      n.includes('tt_test_appid') ||
      n.includes('tt_test_secret') ||
      n.includes('your_app_id') ||
      n.includes('your_app_secret') ||
      n.includes('placeholder')
    );
  }

  /** 新版：GET minigame.zijieapi.com（文档推荐） */
  private async code2SessionNewGet(
    appId: string,
    secret: string,
    loginPayload: { code?: string; anonymousCode?: string },
  ): Promise<string | null> {
    const qs = new URLSearchParams({ appid: appId, secret });
    if (loginPayload.code) {
      qs.set('code', loginPayload.code);
    }
    if (loginPayload.anonymousCode) {
      qs.set('anonymous_code', loginPayload.anonymousCode);
    }
    const url = `https://minigame.zijieapi.com/mgplatform/api/apps/jscode2session?${qs.toString()}`;
    try {
      this.logger.debug('[code2SessionNewGet] requesting official endpoint');
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = (await response.json()) as {
        error?: number;
        errcode?: number;
        openid?: string;
        anonymous_openid?: string;
        errmsg?: string;
        message?: string;
      };
      const err = data.error ?? data.errcode ?? -1;
      if (err !== 0) {
        this.logger.warn(
          `[code2SessionNewGet] failed err=${err}, msg=${data.errmsg ?? data.message ?? 'unknown'}`,
        );
        return null;
      }
      if (data.openid) {
        return data.openid;
      }
      if (data.anonymous_openid) {
        return `anon-${data.anonymous_openid}`;
      }
    } catch (e) {
      this.logger.warn(`[code2SessionNewGet] request exception: ${String(e)}`);
    }
    return null;
  }

  /** 旧版：POST developer.toutiao.com/api/apps/v2/jscode2session */
  private async code2SessionLegacyPost(
    appId: string,
    secret: string,
    loginPayload: { code?: string; anonymousCode?: string },
  ): Promise<string | null> {
    const url = `https://developer.toutiao.com/api/apps/v2/jscode2session`;
    if (!loginPayload.code) {
      // 旧接口兼容性较差，匿名凭证场景仅尝试新版接口
      this.logger.warn('[code2SessionLegacyPost] skipped because code is empty');
      return null;
    }
    this.logger.debug('[code2SessionLegacyPost] requesting legacy endpoint');
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appid: appId, secret, code: loginPayload.code }),
    });
    const data = (await response.json()) as {
      err_no?: number;
      err_tips?: string;
      data?: { openid?: string };
    };
    if (data.err_no !== 0) {
      this.logger.error(`[code2SessionLegacyPost] failed err_no=${data.err_no}, err_tips=${data.err_tips ?? ''}`);
      throw new UnauthorizedException('Login failed: ' + (data.err_tips || 'unknown error'));
    }
    const openId = data.data?.openid;
    return openId ?? null;
  }

  private mask(v: string): string {
    if (!v) return '';
    if (v.length <= 8) return `${v.slice(0, 2)}***`;
    return `${v.slice(0, 4)}***${v.slice(-4)}`;
  }
}
