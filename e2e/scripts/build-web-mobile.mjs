#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = resolve(__dirname, '../dist/web-mobile/index.html');

if (!existsSync(BUNDLE)) {
  console.error('e2e bundle missing. Run at repo root: npm run build:e2e-bundle');
  process.exit(1);
}
console.log('e2e bundle present:', BUNDLE);
