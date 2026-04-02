import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../user/schemas/user.schema';

@Injectable()
export class RankService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async getGlobalRank(limit = 100) {
    return this.userModel
      .find()
      .sort({ highScore: -1 })
      .limit(limit)
      .select('nickname avatar highScore currentRound')
      .lean();
  }
}
