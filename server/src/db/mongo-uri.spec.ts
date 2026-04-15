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
