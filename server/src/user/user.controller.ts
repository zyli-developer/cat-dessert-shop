import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { UserService } from './user.service';
import { ProgressDto } from './dto/progress.dto';

@Controller('api/user')
export class UserController {
  constructor(private userService: UserService) {}

  @Get('profile')
  async getProfile(@Query('openId') openId: string) {
    const user = await this.userService.getProfile(openId);
    return { success: true, data: user };
  }

  @Post('progress')
  async updateProgress(
    @Query('openId') openId: string,
    @Body() dto: ProgressDto,
  ) {
    const user = await this.userService.updateProgress(openId, dto);
    return { success: true, data: user };
  }
}
