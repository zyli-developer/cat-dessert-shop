# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Cat Bakery / 猫咪甜品店** — a Douyin (TikTok China) mini-game. Merge-style gameplay: players drop and combine desserts in a container to fulfill customer orders. Full-stack: Cocos Creator client + NestJS/MongoDB server.

The authoritative platform research (package size limits, `tt` API, IAA monetization) lives in `TikTok小游戏调研报告.md`. `GEMINI.md` contains an older architecture summary; prefer this file when they disagree.

## Repository Layout

```
client/    Cocos Creator 3.8.8 project (TypeScript). Build target: bytedance-mini-game.
           Game scripts are under client/assets/scenes/scripts/
             core/    Gameplay: Container, Dessert, MergeManager, DropController,
                      OverflowDetector, CustomerManager, ScoreManager, ItemManager
             data/    GameTypes, DessertConfig, GameState
             net/     ApiClient, ApiConfig, ApiTypes (talks to NestJS server)
             platform/ Douyin `tt` SDK wrapper
             ui/      Scene controllers (Loading/Home/Game)
server/    NestJS 11 + Mongoose. Modules: auth, user, rank.
scripts/   Node/Sharp image pipeline (generate_images.js, process_images.js,
           optimize_scenes.js) and cocos-mcp-proxy.mjs.
docs/      dev/ (phase-by-phase implementation plans), plans/ (design docs).
```

Phase plans in `docs/dev/phase-*.md` describe the current implementation roadmap; the status table in `docs/dev/README.md` tracks progress.

## Commands

**Server** (run from `server/`):
- `npm install` — install deps
- `npm run start:dev` — dev server with watch, listens on `0.0.0.0:${PORT:-3333}`
- `npm run build` / `npm run start:prod` — production build and run
- `npm test` — Jest unit tests (`*.spec.ts` under `src/`)
- `npm test -- path/to/file.spec.ts` — single test file
- `npm run test:e2e` — e2e tests (uses `test/jest-e2e.json`)
- `npm run lint` — ESLint with auto-fix
- `npm run format` — Prettier

**Client**: open `client/` in Cocos Creator 3.8.8. The build template is configured in `client/build-templates/bytedance-mini-game/`. There is no CLI build command — use Cocos Creator's build UI to produce a Douyin mini-game bundle.

**Full stack via Docker**: `docker-compose up` — starts MongoDB + server on port 3333 (connects to `mongodb://mongodb:27017/catbakery`).

## Architecture Notes

**Server DB bootstrap** (`server/src/app.module.ts`): `getMongoUri()` resolves the Mongo connection dynamically — uses `MONGODB_URI` if set, else probes `127.0.0.1:27017`, else falls back to `mongodb-memory-server`. This means `npm run start:dev` works with zero setup but defaults to an ephemeral in-memory DB. Set `MONGODB_URI` for persistence.

**Client→Server contract**: the client's `net/ApiClient.ts` and `net/ApiTypes.ts` mirror the server's DTOs under `server/src/*/dto/`. When changing an endpoint, update both sides.

**Platform constraints** (enforced in design, not code):
- Main package ≤ 4 MB, total ≤ 20 MB (Douyin limits). Image pipeline in `scripts/` exists to hit this.
- Platform APIs live on the `tt` global (login, ads, payment). Client code accesses them through `platform/` wrappers so non-Douyin builds don't explode.
- Monetization is IAA (rewarded video), not IAP.

## Conventions Picked Up From The Repo

- Server follows standard Nest module layout (`*.controller.ts` / `*.service.ts` / `*.module.ts`, DTOs under `dto/`, Mongoose schemas under `schemas/`).
- Commit style is conventional: `feat:`, `fix:`, `refactor:`, `chore:` (see recent log).
- Docs are split per-phase (`docs/dev/phase-N-*.md`), not monolithic — keep new design docs categorized the same way.
