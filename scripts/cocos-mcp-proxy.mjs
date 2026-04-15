#!/usr/bin/env node
/**
 * Stdio-to-HTTP proxy for Cocos Creator MCP server.
 * Claude Code sends JSON-RPC over stdin, this script forwards to the HTTP endpoint
 * and returns responses on stdout. Bypasses OAuth that Claude Code requires for HTTP MCP.
 */

const MCP_URL = process.env.COCOS_MCP_URL || 'http://127.0.0.1:3334/mcp';

let buffer = '';

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  // JSON-RPC messages are newline-delimited
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed) handleMessage(trimmed);
  }
});

process.stdin.on('end', () => {
  if (buffer.trim()) handleMessage(buffer.trim());
});

async function handleMessage(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    process.stderr.write(`[cocos-mcp-proxy] invalid JSON: ${raw.slice(0, 200)}\n`);
    return;
  }

  try {
    const res = await fetch(MCP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: raw,
    });

    const text = await res.text();
    if (text.trim()) {
      process.stdout.write(text.endsWith('\n') ? text : text + '\n');
    }
  } catch (err) {
    // Return JSON-RPC error if the HTTP call fails
    if (parsed.id != null) {
      const errResp = JSON.stringify({
        jsonrpc: '2.0',
        id: parsed.id,
        error: { code: -32000, message: `HTTP proxy error: ${err.message}` },
      });
      process.stdout.write(errResp + '\n');
    }
    process.stderr.write(`[cocos-mcp-proxy] fetch error: ${err.message}\n`);
  }
}
