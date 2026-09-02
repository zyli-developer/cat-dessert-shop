import { Controller, Delete, Get, Post, Body, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { ProgressDto } from './dto/progress.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { CurrentOpenId } from '../auth/current-open-id.decorator';
import { ClaimRewardDto } from './dto/claim-reward.dto';

@Controller('api/user')
@UseGuards(SessionAuthGuard)
export class UserController {
  constructor(private userService: UserService) {}

  @Get('profile')
  async getProfile(@CurrentOpenId() openId: string) {
    const user = await this.userService.getProfile(openId);
    return { code: 0, data: user };
  }

  @Post('profile')
  async updateInfo(
    @CurrentOpenId() openId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    const result = await this.userService.updateInfo(openId, dto);
    return { code: 0, data: result };
  }

  @Post('progress')
  async updateProgress(
    @CurrentOpenId() openId: string,
    @Body() dto: ProgressDto,
  ) {
    const result = await this.userService.updateProgress(openId, dto);
    return { code: 0, data: result };
  }

  @Post('rewards/claim')
  async claimReward(
    @CurrentOpenId() openId: string,
    @Body() dto: ClaimRewardDto,
  ) {
    const result = await this.userService.claimReward(openId, dto);
    return { code: 0, data: result };
  }

  /** 用户主动注销：删除该抖音账号标识关联的全部游戏数据。 */
  @Delete('account')
  async deleteAccount(@CurrentOpenId() openId: string) {
    const result = await this.userService.deleteAccount(openId);
    return { code: 0, data: result };
  }
}
