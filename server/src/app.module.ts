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
