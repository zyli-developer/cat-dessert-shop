import { MongoMemoryServer } from 'mongodb-memory-server';

export default async function globalSetup(): Promise<void> {
  process.env.AUTH_CODE_EXCHANGER = 'stub';

  // Start MongoMemoryServer ourselves and inject MONGODB_URI so resolveMongoUri short-circuits
  // before reaching the dynamic-import probe path (which trips ts-jest's CommonJS transform on
  // `await import('net')` / `await import('mongodb-memory-server')`).
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();

  // Stash for teardown — Jest globalSetup/globalTeardown share state via a global.
  (globalThis as unknown as { __MONGOD__: MongoMemoryServer }).__MONGOD__ = mongod;
}
