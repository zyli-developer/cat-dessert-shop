export const API_BASE = 'http://127.0.0.1:4568/api';

export interface ApiSession {
  openId: string;
  accessToken: string;
}

export async function loginViaApi(code: string): Promise<ApiSession> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const body: any = await res.json();
  if (res.status >= 400 || body.code !== 0) {
    throw new Error(`login failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return {
    openId: body.data.user.openId,
    accessToken: body.data.accessToken,
  };
}

export async function submitProgress(
  session: ApiSession,
  round: number,
  stars: number,
  score: number,
): Promise<void> {
  const res = await fetch(`${API_BASE}/user/progress`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.accessToken}`,
    },
    body: JSON.stringify({ round, stars, score }),
  });
  if (res.status >= 400) throw new Error(`submit failed: ${res.status}`);
}
