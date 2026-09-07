import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../user/schemas/user.schema';

const ANONYMOUS_RANK_NAME = '猫店玩家';

interface RankSourceUser {
  openId?: string;
  highScore?: number;
  currentRound?: number;
  roundScores?: Record<string, number>;
}

interface SafeRankUser {
  nickname: string;
  avatar: string;
  openId: string;
  score: number;
  currentRound?: number;
}

@Injectable()
export class RankService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async getGlobalRank(limit = 100) {
    const users = (await this.userModel
      .find()
      .sort({ highScore: -1 })
      .limit(limit)
      .select('-_id highScore currentRound')
      .lean()) as unknown as RankSourceUser[];
    return users.map((user) => ({
      nickname: ANONYMOUS_RANK_NAME,
      avatar: '',
      highScore: user.highScore ?? 0,
      currentRound: user.currentRound ?? 1,
    }));
  }

  /**
   * 好友排名（MVP：返回全部用户作为"好友"）
   * @param openId 当前用户
   * @param round 可选，传入时按本关分数排名，不传时按最高关卡排名
   */
  async getFriendsRank(openId: string, round?: number) {
    let users: SafeRankUser[];

    if (round) {
      // 按本关分数排名
      const roundKey = `roundScores.${round}`;
      const sourceUsers = (await this.userModel
        .find({ [roundKey]: { $exists: true } })
        .select(`-_id openId ${roundKey}`)
        .lean()) as unknown as RankSourceUser[];

      // 手动排序（因为 Map 字段无法直接 sort）
      users = sourceUsers.map((u) => ({
        nickname: ANONYMOUS_RANK_NAME,
        avatar: '',
        openId: u.openId ?? '',
        score: u.roundScores?.[String(round)] || 0,
      }));
      users.sort((a, b) => b.score - a.score);
    } else {
      // 按最高关卡排名
      const sourceUsers = (await this.userModel
        .find()
        .sort({ currentRound: -1 })
        .select('-_id openId currentRound highScore')
        .lean()) as unknown as RankSourceUser[];

      users = sourceUsers.map((u) => ({
        nickname: ANONYMOUS_RANK_NAME,
        avatar: '',
        openId: u.openId ?? '',
        score: u.highScore || 0,
        currentRound: u.currentRound,
      }));
    }

    // 找到自己的排名
    const myIndex = users.findIndex((u) => u.openId === openId);
    const myRank = myIndex >= 0 ? myIndex + 1 : users.length + 1;

    // 移除 openId 后返回
    const list = users.map((user) => ({
      nickname: user.nickname,
      avatar: user.avatar,
      score: user.score,
      ...(user.currentRound === undefined
        ? {}
        : { currentRound: user.currentRound }),
    }));

    return { list, myRank };
  }
}
