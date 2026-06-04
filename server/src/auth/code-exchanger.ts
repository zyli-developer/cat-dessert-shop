import { Logger, UnauthorizedException } from '@nestjs/common';

export interface CodeExchangeResult { openid: string; }

export interface CodeExchanger {
  exchange(code: string): Promise<CodeExchangeResult>;
}

export const CODE_EXCHANGER = Symbol('CODE_EXCHANGER');

export class StubCodeExchanger implements CodeExchanger {
  constructor(private readonly table: Record<string, string>) {}
  async exchange(code: string): Promise<CodeExchangeResult> {
    const openid = this.table[code];
    if (!openid) throw new UnauthorizedException('invalid code');
    return { openid };
  }
}

/**
 * Production exchanger: calls Douyin jscode2session to convert a login code into an openid.
 *
 * Two endpoints, tried in order:
 *   1. GET  minigame.zijieapi.com (official, recommended)
 *   2. POST developer.toutiao.com (legacy fallback)
 *
 * Requires env: DOUYIN_APP_ID, DOUYIN_APP_SECRET.
 *
 * Accepts an optional `fetchImpl` for testing (defaults to global `fetch`).
 */
export class DouyinCodeExchanger implements CodeExchanger {
  private readonly logger = new Logger(DouyinCodeExchanger.name);
  private readonly fetchImpl: typeof fetch;

  constructor(fetchImpl?: typeof fetch) {
    this.fetchImpl = fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  async exchange(code: string): Promise<CodeExchangeResult> {
    if (!code?.trim()) {
      throw new UnauthorizedException('Login failed: code is empty');
    }

    const appId = process.env.DOUYIN_APP_ID?.trim();
    const secret = process.env.DOUYIN_APP_SECRET?.trim();

    if (this.isPlaceholderOrEmpty(appId) || this.isPlaceholderOrEmpty(secret)) {
      this.logger.error('[exchange] DOUYIN_APP_ID/SECRET missing or placeholder');
      throw new UnauthorizedException(
        'Login failed: DOUYIN_APP_ID/DOUYIN_APP_SECRET not configured correctly',
      );
    }

    // 1. Try official GET endpoint
    try {
      const openid = await this.code2SessionGet(appId!, secret!, code.trim());
      if (openid) {
        this.logger.log(`[exchange] GET success openId=${this.mask(openid)}`);
        return { openid };
      }
      this.logger.warn('[exchange] GET returned no openid, trying legacy POST');
    } catch (e) {
      this.logger.warn(`[exchange] GET failed: ${e instanceof Error ? e.message : String(e)}, trying legacy POST`);
    }

    // 2. Fallback to legacy POST endpoint
    try {
      const openid = await this.code2SessionPost(appId!, secret!, code.trim());
      if (openid) {
        this.logger.log(`[exchange] POST success openId=${this.mask(openid)}`);
        return { openid };
      }
    } catch (e) {
      this.logger.error(`[exchange] POST failed: ${e instanceof Error ? e.message : String(e)}`);
    }

    throw new UnauthorizedException('Login failed: no openid from code2Session');
  }

  /** GET minigame.zijieapi.com/mgplatform/api/apps/jscode2session */
  private async code2SessionGet(appId: string, secret: string, code: string): Promise<string | null> {
    const qs = new URLSearchParams({ appid: appId, secret, code });
    const url = `https://minigame.zijieapi.com/mgplatform/api/apps/jscode2session?${qs}`;
    const res = await this.fetchImpl(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = (await res.json()) as {
      error?: number;
      errcode?: number;
      openid?: string;
      errmsg?: string;
      message?: string;
    };
    const err = data.error ?? data.errcode ?? -1;
    if (err !== 0) {
      this.logger.warn(`[GET] err=${err}, msg=${data.errmsg ?? data.message ?? 'unknown'}`);
      return null;
    }
    return data.openid ?? null;
  }

  /** POST developer.toutiao.com/api/apps/v2/jscode2session */
  private async code2SessionPost(appId: string, secret: string, code: string): Promise<string | null> {
    const url = 'https://developer.toutiao.com/api/apps/v2/jscode2session';
    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appid: appId, secret, code }),
    });
    const data = (await res.json()) as {
      err_no?: number;
      err_tips?: string;
      data?: { openid?: string };
    };
    if (data.err_no !== 0) {
      this.logger.warn(`[POST] err_no=${data.err_no}, err_tips=${data.err_tips ?? ''}`);
      return null;
    }
    return data.data?.openid ?? null;
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

  private mask(v: string): string {
    if (!v) return '';
    if (v.length <= 8) return `${v.slice(0, 2)}***`;
    return `${v.slice(0, 4)}***${v.slice(-4)}`;
  }
}
