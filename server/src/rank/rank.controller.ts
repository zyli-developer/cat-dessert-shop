import { Controller, Get, Query, Headers, UnauthorizedException } from '@nestjs/common';
import { RankService } from './rank.service';

@Controller('api/rank')
export class RankController {
  constructor(private rankService: RankService) {}

  @Get('global')
  async getGlobalRank(@Query('limit') limit: number) {
    const list = await this.rankService.getGlobalRank(limit || 100);
    return { code: 0, data: list };
  }

  @Get('friends')
  async getFriendsRank(
    @Headers('x-open-id') openId: string,
    @Query('round') round?: string,
  ) {
    if (!openId) throw new UnauthorizedException('Missing X-Open-Id header');
    const roundNum = round ? parseInt(round, 10) : undefined;
    const result = await this.rankService.getFriendsRank(openId, roundNum);
    return { code: 0, data: result };
  }
}
