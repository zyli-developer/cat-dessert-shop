import { Controller, Get, Query } from '@nestjs/common';
import { RankService } from './rank.service';

@Controller('api/rank')
export class RankController {
  constructor(private rankService: RankService) {}

  @Get('global')
  async getGlobalRank(@Query('limit') limit: number) {
    const list = await this.rankService.getGlobalRank(limit || 100);
    return { success: true, data: list };
  }
}
