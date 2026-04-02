import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schemas/user.schema';
import { ProgressDto } from './dto/progress.dto';

const CAT_COIN_REWARDS: Record<number, number> = { 1: 5, 2: 10, 3: 20 };

@Injectable()
export class UserService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async getProfile(openId: string): Promise<User | null> {
    return this.userModel.findOne({ openId });
  }

  async updateProgress(openId: string, dto: ProgressDto): Promise<User> {
    const user = await this.userModel.findOne({ openId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const catCoinReward = CAT_COIN_REWARDS[dto.stars] || 0;

    const currentStars = user.stars.get(String(dto.round)) || 0;
    if (dto.stars > currentStars) {
      user.stars.set(String(dto.round), dto.stars);
    }

    if (dto.score > user.highScore) {
      user.highScore = dto.score;
    }

    if (dto.round >= user.currentRound) {
      user.currentRound = dto.round + 1;
    }

    user.catCoins += catCoinReward;

    return user.save();
  }
}
