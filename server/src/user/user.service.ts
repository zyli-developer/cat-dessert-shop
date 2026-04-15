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

  async updateProgress(openId: string, dto: ProgressDto) {
    const user = await this.userModel.findOne({ openId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const roundKey = String(dto.round);

    // 星级只取最高
    const currentStars = user.stars.get(roundKey) || 0;
    const isNewBestStars = dto.stars > currentStars;
    if (isNewBestStars) {
      user.stars.set(roundKey, dto.stars);
    }

    // 本关分数只取最高
    const currentRoundScore = user.roundScores.get(roundKey) || 0;
    const isNewBestScore = dto.score > currentRoundScore;
    if (isNewBestScore) {
      user.roundScores.set(roundKey, dto.score);
    }

    // 全局最高分
    if (dto.score > user.highScore) {
      user.highScore = dto.score;
    }

    // 关卡只增不减
    if (dto.round >= user.currentRound) {
      user.currentRound = dto.round + 1;
    }

    // 猫币：只在首次达到该星级时奖励（幂等）
    // 计算本次应得猫币 = 新星级奖励 - 旧星级奖励
    if (isNewBestStars) {
      const newReward = CAT_COIN_REWARDS[dto.stars] || 0;
      const oldReward = CAT_COIN_REWARDS[currentStars] || 0;
      user.catCoins += Math.max(0, newReward - oldReward);
    }

    // 客户端额外猫币（如广告奖励等）
    if (dto.catCoinsEarned && dto.catCoinsEarned > 0) {
      user.catCoins += dto.catCoinsEarned;
    }

    await user.save();

    return {
      openId: user.openId,
      nickname: user.nickname,
      avatar: user.avatar,
      catCoins: user.catCoins,
      currentRound: user.currentRound,
      highScore: user.highScore,
      stars: Object.fromEntries(user.stars),
      roundScores: Object.fromEntries(user.roundScores),
      isNewBest: isNewBestScore,
    };
  }
}
