// Minimal fallback shell: exposes a stub game state and a fetch helper on
// window.CatBakery so auth/api/offline specs can exercise server endpoints
// without booting the real Cocos runtime (which depends on DouyinSDK).

type Scene = 'Loading' | 'Home' | 'Game' | 'Result';

export const state = {
  scene: 'Home' as Scene,
  score: 0,
  openId: '' as string,
  setScene(s: Scene): void {
    this.scene = s;
    const el = document.getElementById('app');
    if (el) el.setAttribute('data-scene', s);
  },
};

export async function apiFetch(
  path: string,
  method: string = 'GET',
  body?: unknown,
): Promise<{ status: number; body: any }> {
  const base = (window as any).__API_BASE__ || 'http://127.0.0.1:4568/api';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (state.openId) headers['X-Open-Id'] = state.openId;
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let parsed: any = null;
  try { parsed = await res.json(); } catch { /* ignore */ }
  return { status: res.status, body: parsed };
}

(window as any).__cb = (window as any).__cb || {};
(window as any).__cb.state = state;
(window as any).__cb.apiFetch = apiFetch;
