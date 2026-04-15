# Test Automation Phase T1: Server & Scripts Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stand up the npm workspaces harness, wire up server unit + e2e tests (supertest), add scripts/ unit tests, and land the first three CI jobs (server / scripts-unit / coverage).

**Architecture:** Root `package.json` becomes an npm workspaces entry. Four future workspaces are declared but only `server` and `scripts/tests` are populated in T1. Coverage from each workspace is emitted to `coverage/raw/` and merged with `nyc`. CI runs jobs in parallel on Ubuntu.

**Tech Stack:** npm workspaces, Jest 30, ts-jest, supertest, `mongodb-memory-server`, nyc, GitHub Actions, Codecov.

**Reference design:** `docs/plans/2026-04-15-test-automation-design.md` sections 1, 2.1, 2.4, 4, 5, 6 (server + scripts rows), 7 (Phase T1).

---

## Conventions

- Always commit after each task passes. Commit message format: `test(t1): <task name>` for test additions, `chore(t1): <task>` for config, `feat(t1): <task>` for new production code.
- After every task, run `git status` and confirm working tree matches expectations.
- All Jest configs must emit lcov to `coverage/raw/<workspace-name>/` so the merge job works.
- Run server from `server/` directory; run root scripts from repo root.

---

## Task 1: Bootstrap npm workspaces root

**Files:**
- Modify: `package.json` (currently 6 lines)
- Create: `tsconfig.base.json`
- Modify: `.gitignore`

**Step 1: Back up current package.json**

Run: `cp package.json package.json.bak`

**Step 2: Rewrite root `package.json`**

```json
{
  "name": "catbakery",
  "version": "0.0.0",
  "private": true,
  "workspaces": ["server", "scripts/tests"],
  "scripts": {
    "test": "npm run test:all",
    "test:all": "npm run test:server && npm run test:server:e2e && npm run test:scripts",
    "test:server": "npm --workspace server run test:ci",
    "test:server:e2e": "npm --workspace server run test:e2e:ci",
    "test:scripts": "npm --workspace scripts/tests run test:ci",
    "coverage:merge": "nyc merge coverage/raw coverage/merged.json && nyc report -t coverage --reporter=lcov --reporter=text-summary"
  },
  "devDependencies": {
    "nyc": "^17.0.0",
    "sharp": "^0.34.5"
  }
}
```

Note: `client/tests` and `e2e` are added in T2/T3.

**Step 3: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

**Step 4: Append to `.gitignore`**

```
coverage/
playwright-report/
test-results/
e2e/dist/
```

**Step 5: Install workspace deps**

Run: `npm install`
Expected: `node_modules/` resolves; no error. `package-lock.json` updated.

**Step 6: Verify server workspace still builds**

Run: `npm --workspace server run build`
Expected: PASS (NestJS compiles to `server/dist/`).

**Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.base.json .gitignore
git rm package.json.bak
git commit -m "chore(t1): bootstrap npm workspaces root"
```

---

## Task 2: Add server `test:ci` script with coverage output

**Files:**
- Modify: `server/package.json`

**Step 1: Verify current server test works**

Run: `npm --workspace server test`
Expected: PASS (existing `*.spec.ts` green).

**Step 2: Edit `server/package.json` scripts block**

Add two new scripts (keep existing `test`, `test:e2e`):

```jsonc
"test:ci": "jest --coverage --coverageDirectory=../coverage/raw/server",
"test:e2e:ci": "jest --config ./test/jest-e2e.json --coverage --coverageDirectory=../coverage/raw/server-e2e"
```

**Step 3: Run from root**

Run: `npm run test:server`
Expected: PASS; `coverage/raw/server/lcov.info` exists.

**Step 4: Commit**

```bash
git add server/package.json
git commit -m "chore(t1): add server test:ci and test:e2e:ci scripts"
```

---

## Task 3: Refactor `getMongoUri()` to be testable (TC-INFRA-001)

**Files:**
- Modify: `server/src/app.module.ts`
- Create: `server/src/db/mongo-uri.ts`
- Test: `server/src/db/mongo-uri.spec.ts`

**Step 1: Write the failing test**

Create `server/src/db/mongo-uri.spec.ts`:

```ts
import { resolveMongoUri } from './mongo-uri';

describe('resolveMongoUri', () => {
  it('returns MONGODB_URI env var when set', async () => {
    const uri = await resolveMongoUri({
      env: { MONGODB_URI: 'mongodb://custom/db' },
      probe: async () => true,
      startMemoryServer: async () => 'mongodb://unused',
    });
    expect(uri).toBe('mongodb://custom/db');
  });

  it('returns local MongoDB URI when port 27017 probe succeeds', async () => {
    const uri = await resolveMongoUri({
      env: {},
      probe: async () => true,
      startMemoryServer: async () => 'mongodb://mem',
    });
    expect(uri).toBe('mongodb://localhost:27017/catbakery');
  });

  it('falls back to memory server when probe fails', async () => {
    const uri = await resolveMongoUri({
      env: {},
      probe: async () => false,
      startMemoryServer: async () => 'mongodb://memory',
    });
    expect(uri).toBe('mongodb://memory');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm --workspace server test -- mongo-uri.spec`
Expected: FAIL with "Cannot find module './mongo-uri'".

**Step 3: Create `server/src/db/mongo-uri.ts`**

```ts
export interface MongoUriDeps {
  env: Record<string, string | undefined>;
  probe: () => Promise<boolean>;
  startMemoryServer: () => Promise<string>;
}

export async function resolveMongoUri(deps: MongoUriDeps): Promise<string> {
  if (deps.env.MONGODB_URI) return deps.env.MONGODB_URI;
  if (await deps.probe()) {
    console.log('[DB] Using local MongoDB');
    return 'mongodb://localhost:27017/catbakery';
  }
  const uri = await deps.startMemoryServer();
  console.log(`[DB] Using in-memory MongoDB: ${uri}`);
  return uri;
}

export async function probeLocalMongo(): Promise<boolean> {
  const net = await import('net');
  return new Promise<boolean>((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.on('connect', () => { socket.destroy(); resolve(true); });
    socket.on('timeout', () => { socket.destroy(); resolve(false); });
    socket.on('error', () => resolve(false));
    socket.connect(27017, '127.0.0.1');
  });
}

export async function startMemoryMongo(): Promise<string> {
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const mongod = await MongoMemoryServer.create();
  return mongod.getUri();
}
```

**Step 4: Run test to verify pass**

Run: `npm --workspace server test -- mongo-uri.spec`
Expected: PASS (3 tests).

**Step 5: Refactor `app.module.ts` to use it**

Replace the entire `getMongoUri` function and import it:

```ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { RankModule } from './rank/rank.module';
import { resolveMongoUri, probeLocalMongo, startMemoryMongo } from './db/mongo-uri';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: async () => ({
        uri: await resolveMongoUri({
          env: process.env,
          probe: probeLocalMongo,
          startMemoryServer: startMemoryMongo,
        }),
      }),
    }),
    AuthModule,
    UserModule,
    RankModule,
  ],
})
export class AppModule {}
```

**Step 6: Verify full server suite still passes**

Run: `npm run test:server`
Expected: PASS (including new spec).

**Step 7: Commit**

```bash
git add server/src/db/ server/src/app.module.ts
git commit -m "feat(t1): extract resolveMongoUri as injectable for TC-INFRA-001"
```

---

## Task 4: Add `CodeExchanger` provider for auth (dependency injection)

**Files:**
- Modify: `server/src/auth/auth.service.ts`
- Modify: `server/src/auth/auth.module.ts`
- Create: `server/src/auth/code-exchanger.ts`
- Test: `server/src/auth/code-exchanger.spec.ts`

**Step 1: Read current auth.service.ts**

Run: `cat server/src/auth/auth.service.ts`
Note: identify where code→openid exchange happens (likely a direct HTTP call or stub).

**Step 2: Write the failing test**

Create `server/src/auth/code-exchanger.spec.ts`:

```ts
import { StubCodeExchanger } from './code-exchanger';

describe('StubCodeExchanger', () => {
  it('returns deterministic openid for test code', async () => {
    const ex = new StubCodeExchanger({ 'CODE1': 'OPEN1' });
    expect(await ex.exchange('CODE1')).toEqual({ openid: 'OPEN1' });
  });

  it('throws on unknown code', async () => {
    const ex = new StubCodeExchanger({});
    await expect(ex.exchange('UNKNOWN')).rejects.toThrow(/invalid code/i);
  });
});
```

**Step 3: Run test to verify fail**

Run: `npm --workspace server test -- code-exchanger.spec`
Expected: FAIL.

**Step 4: Create `server/src/auth/code-exchanger.ts`**

```ts
export interface CodeExchangeResult { openid: string; }

export interface CodeExchanger {
  exchange(code: string): Promise<CodeExchangeResult>;
}

export const CODE_EXCHANGER = Symbol('CODE_EXCHANGER');

export class StubCodeExchanger implements CodeExchanger {
  constructor(private readonly table: Record<string, string>) {}
  async exchange(code: string): Promise<CodeExchangeResult> {
    const openid = this.table[code];
    if (!openid) throw new Error('invalid code');
    return { openid };
  }
}

export class DouyinCodeExchanger implements CodeExchanger {
  async exchange(code: string): Promise<CodeExchangeResult> {
    // Production: HTTP call to https://developer.toutiao.com/api/apps/v2/jscode2session
    // Reads APPID/SECRET from env. Keep existing behavior.
    throw new Error('DouyinCodeExchanger not yet implemented — currently stubbed');
  }
}
```

**Step 5: Wire into `auth.module.ts`**

Add to providers:
```ts
{
  provide: CODE_EXCHANGER,
  useFactory: () => process.env.NODE_ENV === 'test'
    ? new StubCodeExchanger({ 'test-code-1': 'openid-1' })
    : new DouyinCodeExchanger(),
},
```

**Step 6: Refactor `auth.service.ts` to inject**

```ts
constructor(@Inject(CODE_EXCHANGER) private readonly codeExchanger: CodeExchanger, /* existing */) {}
```

Replace inline code exchange calls with `this.codeExchanger.exchange(code)`.

**Step 7: Run full server suite**

Run: `npm run test:server`
Expected: PASS.

**Step 8: Commit**

```bash
git add server/src/auth/
git commit -m "feat(t1): inject CodeExchanger provider for auth testability"
```

---

## Task 5: Add auth e2e spec (TC-AUTH-E2E-001)

**Files:**
- Modify: `server/test/jest-e2e.json`
- Create: `server/test/setup-e2e.ts`
- Create: `server/test/auth.e2e-spec.ts`

**Step 1: Read current jest-e2e.json**

Run: `cat server/test/jest-e2e.json`

**Step 2: Update `server/test/jest-e2e.json`**

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testRegex": ".e2e-spec\\.ts$",
  "transform": { "^.+\\.(t|j)s$": "ts-jest" },
  "testEnvironment": "node",
  "setupFilesAfterEach": ["<rootDir>/setup-e2e.ts"],
  "collectCoverageFrom": ["../src/**/*.ts", "!../src/main.ts", "!**/*.d.ts"]
}
```

**Step 3: Create `server/test/setup-e2e.ts`**

```ts
process.env.NODE_ENV = 'test';
```

**Step 4: Write the failing e2e test**

Create `server/test/auth.e2e-spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterAll(async () => { await app.close(); });

  it('POST /auth/login with valid stub code returns token', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ code: 'test-code-1', nickname: 'tester' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('userId');
  });

  it('POST /auth/login with invalid code returns 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ code: 'bogus', nickname: 'x' });
    expect(res.status).toBe(401);
  });

  it('GET /user/progress without token returns 401', async () => {
    const res = await request(app.getHttpServer()).get('/user/progress');
    expect(res.status).toBe(401);
  });
});
```

**Step 5: Install supertest if missing**

Run: `cd server && npm ls supertest`
Expected: listed in devDependencies. If not:
Run: `cd server && npm install -D supertest @types/supertest`

**Step 6: Run e2e**

Run: `npm run test:server:e2e`
Expected: PASS (3 tests); coverage emitted to `coverage/raw/server-e2e/`.

**Step 7: Commit**

```bash
git add server/test/ server/package.json server/package-lock.json
git commit -m "test(t1): add auth e2e spec (TC-AUTH-E2E-001, TC-SEC-001)"
```

---

## Task 6: Add user progress e2e spec

**Files:**
- Create: `server/test/user.e2e-spec.ts`

**Step 1: Write the failing test**

```ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('User Progress (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ code: 'test-code-1', nickname: 'u1' });
    token = res.body.token;
  });

  afterAll(async () => { await app.close(); });

  const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);

  it('updates and retrieves progress (TC-USER-001)', async () => {
    await auth(request(app.getHttpServer()).post('/user/progress').send({ level: 3, stars: 2, score: 450 }))
      .expect(201);
    const res = await auth(request(app.getHttpServer()).get('/user/progress')).expect(200);
    expect(res.body.progress['3']).toMatchObject({ stars: 2, score: 450 });
  });

  it('is idempotent (TC-USER-002)', async () => {
    for (let i = 0; i < 3; i++) {
      await auth(request(app.getHttpServer()).post('/user/progress').send({ level: 3, stars: 2, score: 450 }))
        .expect(201);
    }
    const res = await auth(request(app.getHttpServer()).get('/user/progress')).expect(200);
    expect(res.body.progress['3']).toMatchObject({ stars: 2, score: 450 });
  });

  it('does not downgrade existing high score (TC-USER-003)', async () => {
    await auth(request(app.getHttpServer()).post('/user/progress').send({ level: 3, stars: 3, score: 600 }));
    await auth(request(app.getHttpServer()).post('/user/progress').send({ level: 3, stars: 2, score: 400 }));
    const res = await auth(request(app.getHttpServer()).get('/user/progress')).expect(200);
    expect(res.body.progress['3']).toMatchObject({ stars: 3, score: 600 });
  });

  it('rejects invalid level (TC-USER-004)', async () => {
    await auth(request(app.getHttpServer()).post('/user/progress').send({ level: 99, stars: 1, score: 10 }))
      .expect(400);
  });

  it('strips unknown fields via ValidationPipe whitelist (TC-VALID-001)', async () => {
    const res = await auth(request(app.getHttpServer())
      .post('/user/progress')
      .send({ level: 3, stars: 2, score: 450, malicious: 'drop table' }));
    expect([400, 201]).toContain(res.status); // forbidNonWhitelisted throws 400
  });
});
```

**Step 2: Run — adjust service if needed**

Run: `npm run test:server:e2e -- user.e2e-spec`
Expected: PASS, or failures pointing at real bugs. Fix server code minimally to make tests pass (never change tests to match buggy server).

**Step 3: Commit**

```bash
git add server/test/user.e2e-spec.ts
git commit -m "test(t1): add user progress e2e spec (TC-USER-001..004, TC-VALID-001)"
```

---

## Task 7: Add rank e2e spec (TC-RANK-E2E-001)

**Files:**
- Create: `server/test/rank.e2e-spec.ts`

**Step 1: Write the failing test**

```ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Rank (e2e)', () => {
  let app: INestApplication;

  async function login(code: string, nickname: string): Promise<string> {
    const res = await request(app.getHttpServer()).post('/auth/login').send({ code, nickname });
    return res.body.token;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterAll(async () => { await app.close(); });

  it('returns top-N for a level (TC-RANK-002)', async () => {
    // Seed: 3 users submit for level 3 with different scores
    for (const [code, nick, score] of [
      ['test-code-1', 'alice', 500],
      ['test-code-2', 'bob',   300],
      ['test-code-3', 'carol', 700],
    ] as const) {
      const token = await login(code, nick);
      await request(app.getHttpServer())
        .post('/rank/submit').send({ level: 3, score })
        .set('Authorization', `Bearer ${token}`).expect(201);
    }

    const res = await request(app.getHttpServer()).get('/rank?level=3&limit=20').expect(200);
    const scores = res.body.list.map((r: any) => r.score);
    expect(scores).toEqual([700, 500, 300]);
  });

  it('rejects submit without token (TC-SEC-001)', async () => {
    await request(app.getHttpServer()).post('/rank/submit').send({ level: 3, score: 100 }).expect(401);
  });

  it('rejects negative score (TC-RANK-006)', async () => {
    const token = await login('test-code-1', 'alice');
    await request(app.getHttpServer())
      .post('/rank/submit').send({ level: 3, score: -1 })
      .set('Authorization', `Bearer ${token}`).expect(400);
  });
});
```

Note: adjust stub code table in auth.module.ts to include `test-code-2` and `test-code-3`.

**Step 2: Update stub table**

In `auth.module.ts` provider factory:
```ts
new StubCodeExchanger({
  'test-code-1': 'openid-1',
  'test-code-2': 'openid-2',
  'test-code-3': 'openid-3',
})
```

**Step 3: Run**

Run: `npm run test:server:e2e -- rank.e2e-spec`
Expected: PASS.

**Step 4: Commit**

```bash
git add server/test/rank.e2e-spec.ts server/src/auth/auth.module.ts
git commit -m "test(t1): add rank e2e spec (TC-RANK-002, TC-SEC-001, TC-RANK-006)"
```

---

## Task 8: Bootstrap `scripts/tests/` workspace

**Files:**
- Create: `scripts/tests/package.json`
- Create: `scripts/tests/jest.config.js`

**Step 1: Create `scripts/tests/package.json`**

```json
{
  "name": "@catbakery/scripts-tests",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "test": "jest",
    "test:ci": "jest --coverage --coverageDirectory=../../coverage/raw/scripts"
  },
  "devDependencies": {
    "jest": "^30.0.0",
    "@types/jest": "^30.0.0"
  }
}
```

**Step 2: Create `scripts/tests/jest.config.js`**

```js
module.exports = {
  rootDir: '.',
  testMatch: ['<rootDir>/**/*.spec.{js,mjs}'],
  testEnvironment: 'node',
  collectCoverageFrom: [
    '../generate_images.js',
    '../process_images.js',
    '../optimize_scenes.js',
    '../cocos-mcp-proxy.mjs',
  ],
};
```

**Step 3: Install**

Run: `npm install` (from repo root)
Expected: `scripts/tests/node_modules` hoisted to root `node_modules`.

**Step 4: Verify empty run**

Run: `npm run test:scripts`
Expected: "No tests found" warning, exit 1 — that is OK for now; next task adds a test.

**Step 5: Commit**

```bash
git add scripts/tests/ package.json package-lock.json
git commit -m "chore(t1): bootstrap scripts/tests workspace"
```

---

## Task 9: Add `generate_images.js` spec (TC-SCR-GEN-001..003)

**Files:**
- Create: `scripts/tests/generate_images.spec.js`

**Step 1: Read current generate_images.js**

Run: `cat scripts/generate_images.js`
Note: identify the exported function(s). If none (top-level script), wrap in a function as part of this task.

**Step 2: If not already modular, refactor**

Ensure `scripts/generate_images.js` exposes a pure function, e.g.:

```js
async function generateImages({ sizes, outputDir, sharp = require('sharp') }) { /* ... */ }
module.exports = { generateImages };
```

Keep a CLI footer: `if (require.main === module) generateImages({...}).catch(e => { console.error(e); process.exit(1); });`

**Step 3: Write the failing test**

`scripts/tests/generate_images.spec.js`:

```js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { generateImages } = require('../generate_images');

describe('generateImages', () => {
  let tmp;
  beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gen-')); });
  afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  it('creates one file per size config (TC-SCR-GEN-001)', async () => {
    const sharpMock = () => ({
      resize: () => sharpMock(),
      png: () => sharpMock(),
      toFile: (p) => fs.promises.writeFile(p, Buffer.from('fake')),
    });
    await generateImages({ sizes: [64, 128], outputDir: tmp, sharp: sharpMock });
    expect(fs.readdirSync(tmp).sort()).toEqual(['128.png', '64.png']);
  });

  it('rejects non-numeric size (TC-SCR-GEN-002)', async () => {
    await expect(generateImages({ sizes: ['oops'], outputDir: tmp })).rejects.toThrow();
  });

  it('throws when output path not writable (TC-SCR-GEN-003)', async () => {
    await expect(generateImages({ sizes: [64], outputDir: '/nonexistent/ro' })).rejects.toThrow();
  });
});
```

**Step 4: Run**

Run: `npm run test:scripts`
Expected: PASS.

**Step 5: Commit**

```bash
git add scripts/generate_images.js scripts/tests/generate_images.spec.js
git commit -m "test(t1): add generate_images spec (TC-SCR-GEN-001..003)"
```

---

## Task 10: Add `process_images.js` spec (TC-SCR-PROC-001..004)

**Files:**
- Create: `scripts/tests/process_images.spec.js`
- Possibly modify: `scripts/process_images.js` to export a function (same refactor pattern as task 9).

**Step 1: Refactor if needed** (see Task 9 Step 2 pattern).

**Step 2: Write the tests**

```js
const fs = require('fs'); const os = require('os'); const path = require('path');
const { processImages } = require('../process_images');

function makeSharpMock({ metadata = { hasAlpha: true, size: 100 }, output = Buffer.alloc(512) } = {}) {
  return () => ({
    metadata: async () => metadata,
    resize: function () { return this; },
    png: function () { return this; },
    toBuffer: async () => output,
    toFile: async (p) => fs.promises.writeFile(p, output),
  });
}

describe('processImages', () => {
  let tmp;
  beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'proc-')); });
  afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  it('compresses output ≤ 4MB budget (TC-SCR-PROC-001)', async () => {
    fs.writeFileSync(path.join(tmp, 'a.png'), Buffer.alloc(1024));
    await processImages({ inputDir: tmp, outputDir: tmp, maxBytes: 4*1024*1024, sharp: makeSharpMock() });
    expect(fs.statSync(path.join(tmp, 'a.png')).size).toBeLessThanOrEqual(4*1024*1024);
  });

  it('preserves alpha channel (TC-SCR-PROC-002)', async () => {
    const sharp = makeSharpMock({ metadata: { hasAlpha: true, size: 100 } });
    fs.writeFileSync(path.join(tmp, 'a.png'), Buffer.alloc(1024));
    await expect(processImages({ inputDir: tmp, outputDir: tmp, sharp })).resolves.not.toThrow();
  });

  it('propagates sharp errors (TC-SCR-PROC-003)', async () => {
    const sharp = () => ({ metadata: async () => { throw new Error('bad png'); } });
    fs.writeFileSync(path.join(tmp, 'a.png'), Buffer.alloc(10));
    await expect(processImages({ inputDir: tmp, outputDir: tmp, sharp })).rejects.toThrow(/bad png/);
  });

  it('no-op on empty directory (TC-SCR-PROC-004)', async () => {
    await expect(processImages({ inputDir: tmp, outputDir: tmp, sharp: makeSharpMock() })).resolves.not.toThrow();
  });
});
```

**Step 3: Run + commit** — same pattern as Task 9.

```bash
git add scripts/process_images.js scripts/tests/process_images.spec.js
git commit -m "test(t1): add process_images spec (TC-SCR-PROC-001..004)"
```

---

## Task 11: Add `optimize_scenes.js` spec (TC-SCR-OPT-001..002)

**Files:**
- Create: `scripts/tests/optimize_scenes.spec.js`

**Step 1: Write tests following Task 9 pattern** — idempotent check (run twice, byte-compare output) + schema validation (missing required field rejected).

**Step 2: Run + commit**

```bash
git add scripts/optimize_scenes.js scripts/tests/optimize_scenes.spec.js
git commit -m "test(t1): add optimize_scenes spec (TC-SCR-OPT-001..002)"
```

---

## Task 12: Add `cocos-mcp-proxy.mjs` spec (TC-SCR-MCP-001)

**Files:**
- Create: `scripts/tests/cocos-mcp-proxy.spec.mjs`

**Step 1: Write tests** — spawn proxy on ephemeral port, assert forwards request; second test: port 3333 pre-occupied → proxy picks fallback.

**Step 2: Run + commit**

```bash
git add scripts/cocos-mcp-proxy.mjs scripts/tests/cocos-mcp-proxy.spec.mjs
git commit -m "test(t1): add cocos-mcp-proxy spec (TC-SCR-MCP-001)"
```

---

## Task 13: Verify end-to-end `npm run test:all`

**Step 1: Run from root**

Run: `npm run test:all`
Expected: server unit + server e2e + scripts all PASS; coverage files in `coverage/raw/{server,server-e2e,scripts}/`.

**Step 2: Run coverage merge**

Run: `npm run coverage:merge`
Expected: `coverage/merged.json` and `coverage/lcov.info` exist; `text-summary` printed.

**Step 3: Verify thresholds**

Add `coverageThreshold` to `server/package.json` jest block:
```json
"coverageThreshold": {
  "global": { "branches": 80, "functions": 90, "lines": 90, "statements": 90 }
}
```

Run: `npm run test:server`
Expected: PASS with thresholds enforced.

**Step 4: Commit**

```bash
git add server/package.json
git commit -m "chore(t1): enforce server coverage threshold (lines ≥ 90%)"
```

---

## Task 14: Add GitHub Actions workflow (3 jobs)

**Files:**
- Create: `.github/workflows/test.yml`

**Step 1: Create workflow**

Paste the YAML from design section 5.1, but **only** the `server`, `scripts-unit`, and `coverage` jobs (omit `client-unit` and `e2e` — added in T2/T3).

**Step 2: Push & verify locally with `act` (optional)**

Run: `act -j server` (if `act` installed)
Expected: PASS locally.

**Step 3: Commit**

```bash
git add .github/workflows/test.yml
git commit -m "ci(t1): add server + scripts + coverage jobs"
```

---

## Task 15: Acceptance verification

**Checklist:**

- [ ] `npm run test:all` PASS from fresh `npm ci`
- [ ] `coverage/raw/server/lcov.info` shows ≥ 90% line coverage
- [ ] `coverage/raw/scripts/lcov.info` shows ≥ 80% line coverage
- [ ] `npm run coverage:merge` produces `coverage/lcov.info`
- [ ] CI workflow file validates (`yq eval .github/workflows/test.yml` or push a PR)
- [ ] No regression in `npm --workspace server run build`

**If all green — T1 complete. Next:** `docs/plans/2026-04-15-test-automation-T2-client-unit.md`.
