#!/usr/bin/env node
/**
 * Stdio-to-HTTP proxy for Cocos Creator MCP server.
 * Claude Code sends JSON-RPC over stdin, this script forwards to the HTTP endpoint
 * and returns responses on stdout. Bypasses OAuth that Claude Code requires for HTTP MCP.
 */

import { fileURLToPath } from 'node:url';

const DEFAULT_MCP_URL = 'http://127.0.0.1:3334/mcp';

/**
 * Create a message handler bound to a target URL and I/O sinks.
 * Exposed for testing; the CLI path wires this to process.stdout/stderr/fetch.
 */
export function createHandler({
  url = DEFAULT_MCP_URL,
  fetchImpl = globalThis.fetch,
  stdout = (s) => process.stdout.write(s),
  stderr = (s) => process.stderr.write(s),
} = {}) {
  return async function handleMessage(raw) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      stderr(`[cocos-mcp-proxy] invalid JSON: ${raw.slice(0, 200)}\n`);
      return;
    }

    try {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: raw,
      });

      const text = await res.text();
      if (text.trim()) {
        stdout(text.endsWith('\n') ? text : text + '\n');
      }
    } catch (err) {
      // Return JSON-RPC error if the HTTP call fails
      if (parsed.id != null) {
        const errResp = JSON.stringify({
          jsonrpc: '2.0',
          id: parsed.id,
          error: { code: -32000, message: `HTTP proxy error: ${err.message}` },
        });
        stdout(errResp + '\n');
      }
      stderr(`[cocos-mcp-proxy] fetch error: ${err.message}\n`);
    }
  };
}

/**
 * Attach the stdin line-splitter loop to a handler.
 * Exposed for completeness; the CLI path invokes this with process.stdin.
 */
export function attachStdin(stdin, handleMessage) {
  let buffer = '';
  stdin.setEncoding('utf8');
  stdin.on('data', (chunk) => {
    buffer += chunk;
    // JSON-RPC messages are newline-delimited
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) handleMessage(trimmed);
    }
  });
  stdin.on('end', () => {
    if (buffer.trim()) handleMessage(buffer.trim());
  });
}

// CLI entry — only run when invoked directly, not when imported by tests.
const invokedPath = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (invokedPath) {
  const handler = createHandler({ url: process.env.COCOS_MCP_URL || DEFAULT_MCP_URL });
  attachStdin(process.stdin, handler);
}
