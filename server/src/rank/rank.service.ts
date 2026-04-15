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

  /**
   * 好友排名（MVP：返回全部用户作为"好友"）
   * @param openId 当前用户
   * @param round 可选，传入时按本关分数排名，不传时按最高关卡排名
   */
  async getFriendsRank(openId: string, round?: number) {
    let users: any[];

    if (round) {
      // 按本关分数排名
      const roundKey = `roundScores.${round}`;
      users = await this.userModel
        .find({ [roundKey]: { $exists: true } })
        .select(`nickname avatar openId ${roundKey}`)
        .lean();

      // 手动排序（因为 Map 字段无法直接 sort）
      users = users.map(u => ({
        nickname: u.nickname,
        avatar: u.avatar,
        openId: u.openId,
        score: u.roundScores?.[String(round)] || 0,
      }));
      users.sort((a, b) => b.score - a.score);
    } else {
      // 按最高关卡排名
      users = await this.userModel
        .find()
        .sort({ currentRound: -1 })
        .select('nickname avatar openId currentRound highScore')
        .lean();

      users = users.map(u => ({
        nickname: u.nickname,
        avatar: u.avatar,
        openId: u.openId,
        score: u.highScore || 0,
        currentRound: u.currentRound,
      }));
    }

    // 找到自己的排名
    const myIndex = users.findIndex(u => u.openId === openId);
    const myRank = myIndex >= 0 ? myIndex + 1 : users.length + 1;

    // 移除 openId 后返回
    const list = users.map(({ openId: _, ...rest }) => rest);

    return { list, myRank };
  }
}
