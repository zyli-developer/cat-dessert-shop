import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { ProgressDto } from './dto/progress.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { CurrentOpenId } from '../auth/current-open-id.decorator';

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
}
