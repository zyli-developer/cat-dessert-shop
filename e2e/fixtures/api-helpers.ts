export const API_BASE = 'http://127.0.0.1:4568/api';

export async function loginViaApi(code: string): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const body: any = await res.json();
  if (res.status >= 400 || body.code !== 0) {
    throw new Error(`login failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return body.data.openId;
}

export async function submitProgress(
  openId: string,
  round: number,
  stars: number,
  score: number,
): Promise<void> {
  const res = await fetch(`${API_BASE}/user/progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Open-Id': openId },
    body: JSON.stringify({ round, stars, score }),
  });
  if (res.status >= 400) throw new Error(`submit failed: ${res.status}`);
}
