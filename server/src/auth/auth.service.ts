import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../user/schemas/user.schema';

@Injectable()
export class AuthService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async login(code: string): Promise<User> {
    // TODO: Exchange code for openId via Douyin server API
    // For now, use code as openId for development
    const openId = code;

    let user = await this.userModel.findOne({ openId });
    if (!user) {
      user = await this.userModel.create({ openId });
    }
    return user;
  }
}
