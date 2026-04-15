# Project Overview: Cat Bakery (TikTok Mini-Game)

This project is a full-stack TikTok (Douyin) mini-game called **Cat Bakery** (also referred to as Cat Shop). It features a merge-style gameplay loop where players combine desserts to fulfill customer orders. The project includes a Cocos Creator client and a NestJS server backend.

## Architecture

- **Client:** [Cocos Creator 3.8.8](https://docs.cocos.com/creator/3.8/manual/zh/) using TypeScript.
  - Located in the `client/` directory.
  - Logic is structured in `client/assets/scenes/scripts/`:
    - `core/`: Game mechanics like `MergeManager.ts`, `CustomerManager.ts`, and `DropController.ts`.
    - `net/`: API client and configuration for server communication.
    - `platform/`: Platform-specific integrations (e.g., Douyin `tt` API).
    - `ui/`: User interface components.
- **Server:** [NestJS](https://nestjs.com/) with [Mongoose](https://mongoosejs.com/) (MongoDB).
  - Located in the `server/` directory.
  - Modules include `Auth`, `User`, and `Rank` (leaderboards).
  - Uses `mongodb-memory-server` in development if a local MongoDB instance is not available.
- **Research:** Comprehensive documentation on the TikTok/Douyin mini-game ecosystem, including monetization (IAA/IAP) and platform requirements, is in `TikTok小游戏调研报告.md`.

## Development Workflows

### Server

- **Install Dependencies:** `cd server && npm install`
- **Start Development Server:** `npm run start:dev`
  - Runs on `http://0.0.0.0:3333` (configurable via `PORT` and `HOST` env vars).
  - Automatically handles MongoDB connection (local or in-memory).
- **Build:** `npm run build`
- **Test:** `npm run test`

### Client

- **Open Project:** Use Cocos Creator 3.8.8 to open the `client/` folder.
- **Build Target:** `bytedance-mini-game`.
- **Scripts:** 
  - `client/scripts/optimize_png_assets.py`: Python script for optimizing PNG assets to meet the 4MB/20MB platform limits.

### Tools & Utilities

- **Root Directory:**
  - `package.json`: Contains `sharp` for image processing.
  - `scripts/`:
    - `generate_images.js`: Generates game assets.
    - `process_images.js`: Processes/optimizes images using Sharp.
  - `docker-compose.yml`: For containerized deployment (e.g., MongoDB).

## Technical Specifications & Constraints

- **Platform:** Douyin (TikTok China).
- **Package Limits:** 4MB for the main package, 20MB total (including subpackages).
- **API:** Uses the `tt` global namespace for platform features (Login, Ads, Payment).
- **Monetization:** Primarily IAA (In-App Advertising) using rewarded video ads.

## Key Files

- `TikTok小游戏调研报告.md`: Deep dive into the platform's requirements and best practices.
- `server/src/app.module.ts`: Core server module with dynamic DB connection logic.
- `client/assets/scenes/scripts/core/MergeManager.ts`: Central game logic for the merge mechanic.
- `client/assets/scenes/scripts/net/ApiClient.ts`: Handles requests to the NestJS backend.
- `GEMINI.md`: This file, providing project context and instructions.
