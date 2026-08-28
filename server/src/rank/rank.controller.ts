import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RankService } from './rank.service';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { CurrentOpenId } from '../auth/current-open-id.decorator';

@Controller('api/rank')
export class RankController {
  constructor(private rankService: RankService) {}

  @Get('global')
  async getGlobalRank(@Query('limit') limit: number) {
    const list = await this.rankService.getGlobalRank(limit || 100);
    return { code: 0, data: list };
  }

  @Get('friends')
  @UseGuards(SessionAuthGuard)
  async getFriendsRank(
    @CurrentOpenId() openId: string,
    @Query('round') round?: string,
  ) {
    const roundNum = round ? parseInt(round, 10) : undefined;
    const result = await this.rankService.getFriendsRank(openId, roundNum);
    return { code: 0, data: result };
  }
}
