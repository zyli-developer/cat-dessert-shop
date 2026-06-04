/**
 * TC-SCR-MCP-001 — cocos-mcp-proxy stdio→HTTP relay
 *
 * NOTE on scope divergence from the template:
 * The original TC-SCR-MCP-001 description ("port occupied → fallback port OR
 * graceful error") assumes cocos-mcp-proxy binds a TCP port. It does NOT —
 * it is a stdio-to-HTTP proxy that forwards newline-delimited JSON-RPC from
 * stdin to an HTTP MCP endpoint (COCOS_MCP_URL, default 127.0.0.1:3334/mcp)
 * and pipes the response to stdout. There is no listening socket that could
 * be "occupied".
 *
 * We therefore map TC-SCR-MCP-001 to the script's actual failure-mode
 * equivalents and forwarding contract:
 *   1. Request forwarding: a JSON-RPC message on stdin is POSTed to the
 *      configured URL with the raw body and Content-Type: application/json;
 *      the response body is written to stdout (with trailing newline).
 *   2. Graceful error on backend unreachable: if fetch() rejects (the HTTP
 *      analogue of "port occupied / endpoint unavailable"), the proxy emits
 *      a JSON-RPC error response (code -32000) for requests carrying an id,
 *      and logs to stderr — it does not crash the process.
 *   3. Invalid JSON on stdin is logged to stderr and swallowed (no stdout
 *      output, no throw).
 *   4. Notifications (no id) on fetch failure: stderr log only, no stdout
 *      response (per JSON-RPC spec — notifications MUST NOT be replied to).
 */

describe('cocos-mcp-proxy (TC-SCR-MCP-001 — stdio→HTTP relay)', () => {
  let createHandler;

  beforeAll(async () => {
    const mod = await import('../cocos-mcp-proxy.mjs');
    createHandler = mod.createHandler;
  });

  function makeSinks() {
    const stdout = [];
    const stderr = [];
    return {
      stdout,
      stderr,
      write: {
        stdout: (s) => stdout.push(s),
        stderr: (s) => stderr.push(s),
      },
    };
  }

  it('forwards a JSON-RPC request to the configured URL and pipes the response to stdout', async () => {
    const sinks = makeSinks();
    const req = { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} };
    const raw = JSON.stringify(req);

    let seenUrl;
    let seenInit;
    const fetchImpl = jest.fn(async (url, init) => {
      seenUrl = url;
      seenInit = init;
      return {
        text: async () => JSON.stringify({ jsonrpc: '2.0', id: 1, result: { tools: [] } }),
      };
    });

    const handle = createHandler({
      url: 'http://127.0.0.1:9999/mcp',
      fetchImpl,
      stdout: sinks.write.stdout,
      stderr: sinks.write.stderr,
    });

    await handle(raw);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(seenUrl).toBe('http://127.0.0.1:9999/mcp');
    expect(seenInit.method).toBe('POST');
    expect(seenInit.headers['Content-Type']).toBe('application/json');
    expect(seenInit.body).toBe(raw); // raw line is forwarded verbatim
    expect(sinks.stdout.join('')).toBe(
      JSON.stringify({ jsonrpc: '2.0', id: 1, result: { tools: [] } }) + '\n',
    );
    expect(sinks.stderr).toEqual([]);
  });

  it('does not add a second newline when the response already ends with one', async () => {
    const sinks = makeSinks();
    const fetchImpl = async () => ({ text: async () => '{"jsonrpc":"2.0","id":2,"result":true}\n' });

    const handle = createHandler({
      url: 'http://x/mcp',
      fetchImpl,
      stdout: sinks.write.stdout,
      stderr: sinks.write.stderr,
    });

    await handle('{"jsonrpc":"2.0","id":2,"method":"ping"}');

    const out = sinks.stdout.join('');
    expect(out).toBe('{"jsonrpc":"2.0","id":2,"result":true}\n');
    expect(out.endsWith('\n\n')).toBe(false);
  });

  it('suppresses stdout when the backend returns an empty body (e.g. notification ACK)', async () => {
    const sinks = makeSinks();
    const fetchImpl = async () => ({ text: async () => '   \n' });

    const handle = createHandler({
      url: 'http://x/mcp',
      fetchImpl,
      stdout: sinks.write.stdout,
      stderr: sinks.write.stderr,
    });

    await handle('{"jsonrpc":"2.0","method":"notifications/initialized"}');

    expect(sinks.stdout).toEqual([]);
    expect(sinks.stderr).toEqual([]);
  });

  it('emits a JSON-RPC error response (code -32000) when fetch rejects on a request with id', async () => {
    const sinks = makeSinks();
    const fetchImpl = async () => {
      throw new Error('ECONNREFUSED 127.0.0.1:3334');
    };

    const handle = createHandler({
      url: 'http://127.0.0.1:3334/mcp',
      fetchImpl,
      stdout: sinks.write.stdout,
      stderr: sinks.write.stderr,
    });

    await handle('{"jsonrpc":"2.0","id":42,"method":"tools/call"}');

    expect(sinks.stdout).toHaveLength(1);
    const parsed = JSON.parse(sinks.stdout[0]);
    expect(parsed).toEqual({
      jsonrpc: '2.0',
      id: 42,
      error: { code: -32000, message: expect.stringContaining('HTTP proxy error') },
    });
    expect(parsed.error.message).toContain('ECONNREFUSED');
    expect(sinks.stderr.join('')).toContain('[cocos-mcp-proxy] fetch error:');
  });

  it('does NOT write stdout for a notification (no id) when fetch rejects, per JSON-RPC spec', async () => {
    const sinks = makeSinks();
    const fetchImpl = async () => {
      throw new Error('boom');
    };

    const handle = createHandler({
      url: 'http://x/mcp',
      fetchImpl,
      stdout: sinks.write.stdout,
      stderr: sinks.write.stderr,
    });

    await handle('{"jsonrpc":"2.0","method":"notifications/cancelled"}');

    expect(sinks.stdout).toEqual([]);
    expect(sinks.stderr.join('')).toContain('fetch error');
  });

  it('logs to stderr and swallows invalid JSON on stdin without calling fetch', async () => {
    const sinks = makeSinks();
    const fetchImpl = jest.fn();

    const handle = createHandler({
      url: 'http://x/mcp',
      fetchImpl,
      stdout: sinks.write.stdout,
      stderr: sinks.write.stderr,
    });

    await handle('not json {{{');

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(sinks.stdout).toEqual([]);
    expect(sinks.stderr.join('')).toContain('[cocos-mcp-proxy] invalid JSON:');
  });

  it('truncates the invalid-JSON stderr log to 200 chars of the offending payload', async () => {
    const sinks = makeSinks();
    const handle = createHandler({
      url: 'http://x/mcp',
      fetchImpl: async () => ({ text: async () => '' }),
      stdout: sinks.write.stdout,
      stderr: sinks.write.stderr,
    });

    const huge = 'x'.repeat(500) + 'not-json';
    await handle(huge);

    const log = sinks.stderr.join('');
    expect(log).toContain('invalid JSON:');
    // prefix "[cocos-mcp-proxy] invalid JSON: " + up to 200 chars + "\n"
    const payload = log.replace('[cocos-mcp-proxy] invalid JSON: ', '').replace(/\n$/, '');
    expect(payload.length).toBeLessThanOrEqual(200);
  });
});
