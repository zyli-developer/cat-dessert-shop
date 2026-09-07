import { afterEach, describe, expect, it } from '@jest/globals';
import net from 'node:net';
import { isTcpPortOpen } from '../../e2e/scripts/port-check.mjs';

const servers = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(
    (server) => new Promise((resolve) => server.close(resolve)),
  ));
});

describe('Cocos headless MCP port preflight', () => {
  it('detects an active Creator MCP listener', async () => {
    const server = net.createServer();
    servers.push(server);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();

    expect(typeof address).toBe('object');
    await expect(isTcpPortOpen(address.port)).resolves.toBe(true);
  });

  it('returns false after the listener is closed', async () => {
    const server = net.createServer();
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    await new Promise((resolve) => server.close(resolve));

    expect(typeof address).toBe('object');
    await expect(isTcpPortOpen(address.port)).resolves.toBe(false);
  });
});
