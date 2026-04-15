import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { RankModule } from './rank/rank.module';

async function getMongoUri(): Promise<string> {
  if (process.env.MONGODB_URI) {
    return process.env.MONGODB_URI;
  }

  // 开发环境：尝试连接本地 MongoDB，失败则启动内存数据库
  try {
    const net = await import('net');
    await new Promise<void>((resolve, reject) => {
      const socket = new net.Socket();
      socket.setTimeout(1000);
      socket.on('connect', () => { socket.destroy(); resolve(); });
      socket.on('timeout', () => { socket.destroy(); reject(); });
      socket.on('error', () => reject());
      socket.connect(27017, '127.0.0.1');
    });
    console.log('[DB] Using local MongoDB');
    return 'mongodb://localhost:27017/catbakery';
  } catch {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    console.log(`[DB] Using in-memory MongoDB: ${uri}`);
    return uri;
  }
}

@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: async () => ({
        uri: await getMongoUri(),
      }),
    }),
    AuthModule,
    UserModule,
    RankModule,
  ],
})
export class AppModule {}
