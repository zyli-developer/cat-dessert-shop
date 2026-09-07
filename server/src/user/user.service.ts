import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schemas/user.schema';
import { ProgressDto } from './dto/progress.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ClaimRewardDto, RewardKind } from './dto/claim-reward.dto';
import { calculateStars } from '../game/level-rules';
import {
  sanitizePublicAvatar,
  sanitizePublicNickname,
} from '../common/content-safety';

const CAT_COIN_REWARDS: Record<number, number> = { 1: 5, 2: 10, 3: 20 };
const HOME_AD_REWARD = 10;
const HOME_AD_DAILY_LIMIT = 5;
const HOME_AD_COOLDOWN_MS = 25_000;
const DAILY_GIFT_REWARD = 20;
const DAILY_GIFT_DOUBLE_REWARD = 40;

@Injectable()
export class UserService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async getProfile(openId: string): Promise<User | null> {
    return this.userModel.findOne({ openId });
  }

  /** 删除用户文档中的标识、资料、进度、排行榜和奖励记录。接口保持幂等。 */
  async deleteAccount(openId: string): Promise<{ deleted: boolean }> {
    await this.userModel.deleteOne({ openId });
    return { deleted: true };
  }

  /** 更新公开昵称/头像；仅允许由用户主动授权入口调用。空值不覆盖已有数据。 */
  async updateInfo(openId: string, dto: UpdateProfileDto) {
    const user = await this.userModel.findOne({ openId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.nickname?.trim())
      user.nickname = sanitizePublicNickname(dto.nickname);
    if (dto.avatar?.trim()) user.avatar = sanitizePublicAvatar(dto.avatar);
    await user.save();

    return {
      openId: user.openId,
      nickname: user.nickname,
      avatar: user.avatar,
    };
  }

  async updateProgress(openId: string, dto: ProgressDto) {
    const user = await this.userModel.findOne({ openId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.round > user.currentRound) {
      throw new BadRequestException('Round is not unlocked');
    }
    const calculatedStars = calculateStars(dto.round, dto.score);
    if (dto.stars !== calculatedStars) {
      throw new BadRequestException('Stars do not match the submitted score');
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

  async claimReward(openId: string, dto: ClaimRewardDto) {
    const user = await this.userModel.findOne({ openId });
    if (!user) throw new NotFoundException('User not found');

    if (user.rewardClaimIds?.includes(dto.claimId)) {
      return this.rewardResult(user, 0, true);
    }

    switch (dto.kind) {
      case RewardKind.HOME_AD:
        return this.claimHomeAd(openId, dto.claimId);
      case RewardKind.WIN_DOUBLE:
        return this.claimWinDouble(user, dto);
      case RewardKind.DAILY_GIFT:
      case RewardKind.DAILY_GIFT_DOUBLE:
        return this.claimDailyGift(openId, dto);
    }
  }

  private async claimHomeAd(openId: string, claimId: string) {
    const today = this.cstDateKey();
    const now = Date.now();
    const countPath = `adRewardDailyCounts.${today}`;
    const lastPath = `adRewardLastClaimAt.${today}`;
    const updated = await this.userModel.findOneAndUpdate(
      {
        openId,
        rewardClaimIds: { $ne: claimId },
        $expr: {
          $lt: [{ $ifNull: [`$${countPath}`, 0] }, HOME_AD_DAILY_LIMIT],
        },
        $or: [
          { [lastPath]: { $exists: false } },
          { [lastPath]: { $lte: now - HOME_AD_COOLDOWN_MS } },
        ],
      },
      {
        $inc: { catCoins: HOME_AD_REWARD, [countPath]: 1 },
        $set: { [lastPath]: now },
        $push: { rewardClaimIds: { $each: [claimId], $slice: -200 } },
      },
      { returnDocument: 'after' },
    );
    if (!updated) {
      const latest = await this.userModel.findOne({ openId });
      if (latest?.rewardClaimIds?.includes(claimId))
        return this.rewardResult(latest, 0, true);
      throw new HttpException(
        'Ad reward cooldown or daily limit reached',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return this.rewardResult(updated, HOME_AD_REWARD, false);
  }

  private async claimWinDouble(user: User, dto: ClaimRewardDto) {
    if (!dto.round)
      throw new BadRequestException('round is required for win_double');
    const stars = user.stars.get(String(dto.round)) || 0;
    if (!stars) throw new BadRequestException('Round has not been completed');
    if (user.doubledRounds?.includes(dto.round)) {
      throw new ConflictException('Win reward already doubled for this round');
    }

    const reward = CAT_COIN_REWARDS[stars] || 0;
    const updated = await this.userModel.findOneAndUpdate(
      {
        openId: user.openId,
        rewardClaimIds: { $ne: dto.claimId },
        doubledRounds: { $ne: dto.round },
        [`stars.${dto.round}`]: stars,
      },
      {
        $inc: { catCoins: reward },
        $addToSet: { doubledRounds: dto.round },
        $push: { rewardClaimIds: { $each: [dto.claimId], $slice: -200 } },
      },
      { returnDocument: 'after' },
    );
    if (!updated) {
      const latest = await this.userModel.findOne({ openId: user.openId });
      if (latest?.rewardClaimIds?.includes(dto.claimId))
        return this.rewardResult(latest, 0, true);
      throw new ConflictException('Win reward already doubled for this round');
    }
    return this.rewardResult(updated, reward, false);
  }

  private async claimDailyGift(openId: string, dto: ClaimRewardDto) {
    const today = this.cstDateKey();
    const reward =
      dto.kind === RewardKind.DAILY_GIFT_DOUBLE
        ? DAILY_GIFT_DOUBLE_REWARD
        : DAILY_GIFT_REWARD;
    const updated = await this.userModel.findOneAndUpdate(
      {
        openId,
        rewardClaimIds: { $ne: dto.claimId },
        dailyGiftDate: { $ne: today },
      },
      {
        $inc: { catCoins: reward },
        $set: { dailyGiftDate: today },
        $push: { rewardClaimIds: { $each: [dto.claimId], $slice: -200 } },
      },
      { returnDocument: 'after' },
    );
    if (!updated) {
      const latest = await this.userModel.findOne({ openId });
      if (latest?.rewardClaimIds?.includes(dto.claimId))
        return this.rewardResult(latest, 0, true);
      throw new ConflictException('Daily gift already claimed');
    }
    return this.rewardResult(updated, reward, false);
  }

  private rewardResult(user: User, awarded: number, alreadyClaimed: boolean) {
    return {
      openId: user.openId,
      nickname: user.nickname,
      avatar: user.avatar,
      catCoins: user.catCoins,
      currentRound: user.currentRound,
      highScore: user.highScore,
      stars: Object.fromEntries(user.stars),
      roundScores: Object.fromEntries(user.roundScores),
      awarded,
      alreadyClaimed,
    };
  }

  private cstDateKey(now = new Date()): string {
    return new Date(now.getTime() + 8 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
  }
}
