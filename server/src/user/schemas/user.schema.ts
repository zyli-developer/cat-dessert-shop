import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true, unique: true, index: true })
  openId: string;

  @Prop({ default: '' })
  nickname: string;

  @Prop({ default: '' })
  avatar: string;

  @Prop({ default: 0 })
  catCoins: number;

  @Prop({ default: 1 })
  currentRound: number;

  @Prop({ default: 0 })
  highScore: number;

  @Prop({ type: Map, of: Number, default: {} })
  stars: Map<string, number>;

  /** 每关最高分 Record<round, score> */
  @Prop({ type: Map, of: Number, default: {} })
  roundScores: Map<string, number>;

  /** 最近的奖励请求 ID；用于网络重试幂等，保留最近 200 条。 */
  @Prop({ type: [String], default: [] })
  rewardClaimIds: string[];

  /** 首页广告每日领取次数，key 为 UTC+8 日期。 */
  @Prop({ type: Map, of: Number, default: {} })
  adRewardDailyCounts: Map<string, number>;

  /** 首页广告最后领取时间戳，key 为 UTC+8 日期。 */
  @Prop({ type: Map, of: Number, default: {} })
  adRewardLastClaimAt: Map<string, number>;

  /** 已领取过胜利翻倍的关卡。 */
  @Prop({ type: [Number], default: [] })
  doubledRounds: number[];

  /** 每日礼包最后领取日期（UTC+8，YYYY-MM-DD）。 */
  @Prop({ default: '' })
  dailyGiftDate: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
