#!/usr/bin/env node

const url = process.env.PUBLIC_HEALTH_URL ?? 'https://jingjingyeye.vip:8099/health';
const timeoutMs = Number(process.env.HEALTH_TIMEOUT_MS ?? 10_000);
const startedAt = Date.now();

try {
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error(`invalid JSON response: ${body.slice(0, 200)}`);
  }
  if (parsed?.status !== 'ok') {
    throw new Error(`unexpected health response: ${body.slice(0, 200)}`);
  }
  console.log(`[production-health] OK ${url} (${Date.now() - startedAt}ms)`);
} catch (error) {
  const detail = error?.cause?.message ?? error?.message ?? String(error);
  console.error(`[production-health] FAIL ${url} (${Date.now() - startedAt}ms): ${detail}`);
  process.exitCode = 1;
}
