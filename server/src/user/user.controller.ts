import { Controller, Get, Post, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { UserService } from './user.service';
import { ProgressDto } from './dto/progress.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('api/user')
export class UserController {
  constructor(private userService: UserService) {}

  @Get('profile')
  async getProfile(@Headers('x-open-id') openId: string) {
    if (!openId) throw new UnauthorizedException('Missing X-Open-Id header');
    const user = await this.userService.getProfile(openId);
    return { code: 0, data: user };
  }

  @Post('profile')
  async updateInfo(
    @Headers('x-open-id') openId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    if (!openId) throw new UnauthorizedException('Missing X-Open-Id header');
    const result = await this.userService.updateInfo(openId, dto);
    return { code: 0, data: result };
  }

  @Post('progress')
  async updateProgress(
    @Headers('x-open-id') openId: string,
    @Body() dto: ProgressDto,
  ) {
    if (!openId) throw new UnauthorizedException('Missing X-Open-Id header');
    const result = await this.userService.updateProgress(openId, dto);
    return { code: 0, data: result };
  }
}
