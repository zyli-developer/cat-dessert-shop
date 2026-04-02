import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RankController } from './rank.controller';
import { RankService } from './rank.service';
import { User, UserSchema } from '../user/schemas/user.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])],
  controllers: [RankController],
  providers: [RankService],
})
export class RankModule {}
