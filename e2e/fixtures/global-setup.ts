import { FullConfig } from '@playwright/test';
import { execSync, spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { MongoMemoryServer } from 'mongodb-memory-server';

export default async function globalSetup(_config: FullConfig): Promise<void> {
  // 1. Build and start an isolated API + MongoDB for this test run.
  const serverCwd = path.resolve(__dirname, '../../server');
  execSync('npm run build', { cwd: serverCwd, stdio: 'inherit' });
  const mongod = await MongoMemoryServer.create();
  const serverProc = spawn(
    process.execPath,
    [path.join(serverCwd, 'dist', 'main.js')],
    {
      env: {
        ...process.env,
        PORT: '4568',
        NODE_ENV: 'test',
        AUTH_CODE_EXCHANGER: 'stub',
        AUTH_TOKEN_SECRET: 'catbakery-e2e-session-secret-32-bytes',
        MONGODB_URI: mongod.getUri(),
      },
      cwd: serverCwd,
      stdio: 'inherit',
    },
  );

  (globalThis as any).__E2E_SERVERS__ = { serverProc, mongod };

  // Health poll
  const healthURL = 'http://127.0.0.1:4568/health';
  await new Promise<void>((resolve, reject) => {
    const start = Date.now();
    const timeout = 60_000;
    const poll = () => {
      http
        .get(healthURL, (res) => {
          if (res.statusCode === 200) resolve();
          else setTimeout(poll, 500);
        })
        .on('error', () => {
          if (Date.now() - start > timeout) reject(new Error('server health check timeout'));
          else setTimeout(poll, 500);
        });
    };
    setTimeout(poll, 1000);
  });

  // 2. Static file server on port 4567
  const distDir = path.resolve(__dirname, '../dist/web-mobile');
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    throw new Error(`Missing web-mobile build. Run: npm --workspace e2e run build:client`);
  }
  const staticServer = http.createServer((req, res) => {
    const urlPath = req.url === '/' || !req.url ? '/index.html' : req.url.split('?')[0];
    const filePath = path.join(distDir, urlPath);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.statusCode = 404;
      return res.end('Not found');
    }
    const ext = path.extname(filePath);
    const contentType =
      ext === '.html' ? 'text/html' : ext === '.js' ? 'application/javascript' : 'text/plain';
    res.setHeader('Content-Type', contentType);
    res.end(fs.readFileSync(filePath));
  });
  await new Promise<void>((resolve) => staticServer.listen(4567, () => resolve()));

  process.env.API_BASE = 'http://127.0.0.1:4568/api';

  (globalThis as any).__E2E_SERVERS__.staticServer = staticServer;
}
