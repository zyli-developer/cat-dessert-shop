import { IsInt, Min, Max } from 'class-validator';
import { MAX_REPORTED_SCORE, TOTAL_ROUNDS } from '../../game/level-rules';

export class ProgressDto {
  @IsInt()
  @Min(1)
  @Max(TOTAL_ROUNDS)
  round: number;

  @IsInt()
  @Min(0)
  @Max(MAX_REPORTED_SCORE)
  score: number;

  @IsInt()
  @Min(1)
  @Max(3)
  stars: number;
}
