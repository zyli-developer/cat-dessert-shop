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
}

export const UserSchema = SchemaFactory.createForClass(User);
