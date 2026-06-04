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
