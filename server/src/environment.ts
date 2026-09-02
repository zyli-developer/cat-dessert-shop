import fs from 'node:fs';
import path from 'node:path';
import { config } from 'dotenv';

// 本地开发只读取仓库根目录 .env；Docker/生产环境直接使用容器注入的环境变量。
// ENV_FILE 仅用于需要显式指定配置文件的独立运行场景。
const explicitEnvFile = process.env.ENV_FILE?.trim();
const candidates = explicitEnvFile
  ? [path.resolve(explicitEnvFile)]
  : [path.resolve(__dirname, '..', '..', '.env')];

const envFile = candidates.find((candidate) => fs.existsSync(candidate));
if (envFile) config({ path: envFile, quiet: true });
