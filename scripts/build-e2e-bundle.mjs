#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const CLIENT = join(ROOT, 'client');
const OUTDIR = join(ROOT, 'e2e/dist/web-mobile');
const COCOS = process.env.COCOS_CREATOR_PATH || 'CocosCreator';

function hashAssets() {
  const h = createHash('sha256');
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else {
        h.update(relative(CLIENT, p));
        h.update(readFileSync(p));
      }
    }
  };
  walk(join(CLIENT, 'assets'));
  walk(join(CLIENT, 'settings'));
  return h.digest('hex');
}

function build() {
  const hash = hashAssets();
  console.log(`Asset hash: ${hash}`);
  const existing = existsSync(join(OUTDIR, '__asset-hash'))
    ? readFileSync(join(OUTDIR, '__asset-hash'), 'utf8').trim()
    : null;
  if (existing === hash && existsSync(join(OUTDIR, 'index.html'))) {
    console.log('Bundle already fresh, skipping rebuild.');
    return;
  }
  console.log('Invoking Cocos Creator CLI…');
  const cocosOut = join(CLIENT, 'build/web-mobile');
  try {
    execSync(
      `"${COCOS}" --project "${CLIENT}" --build "platform=web-mobile;debug=false;md5Cache=false"`,
      { stdio: 'inherit' }
    );
  } catch (err) {
    // Cocos Creator 3.8 headless CLI frequently exits non-zero even on a
    // successful build (observed status=36 on Windows). Treat "output present"
    // as the authoritative success signal.
    if (!existsSync(join(cocosOut, 'index.html'))) {
      throw err;
    }
    console.warn(`Cocos CLI exited status=${err.status}, but ${cocosOut}/index.html exists — treating as success.`);
  }
  if (!existsSync(cocosOut)) {
    throw new Error(`Cocos output not found at ${cocosOut}`);
  }
  execSync(`rm -rf "${OUTDIR}" && mkdir -p "${OUTDIR}" && cp -R "${cocosOut}/"* "${OUTDIR}/"`, { stdio: 'inherit' });
  writeFileSync(join(OUTDIR, '__asset-hash'), hash + '\n');
  console.log(`Bundle written to ${OUTDIR}`);
}

build();
