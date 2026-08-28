import { IsEnum, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

const MAX_GAME_ROUND = 30;

export enum RewardKind {
  HOME_AD = 'home_ad',
  WIN_DOUBLE = 'win_double',
  DAILY_GIFT = 'daily_gift',
  DAILY_GIFT_DOUBLE = 'daily_gift_double',
}

export class ClaimRewardDto {
  @IsEnum(RewardKind)
  kind: RewardKind;

  @Matches(/^[A-Za-z0-9_-]{12,64}$/)
  claimId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_GAME_ROUND)
  round?: number;
}
