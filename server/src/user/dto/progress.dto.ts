import { IsNumber, Min, Max, IsOptional } from 'class-validator';

export class ProgressDto {
  @IsNumber()
  round: number;

  @IsNumber()
  score: number;

  @IsNumber()
  @Min(1)
  @Max(3)
  stars: number;

  @IsNumber()
  @IsOptional()
  catCoinsEarned?: number;
}
