import { IsNumber, Min, Max } from 'class-validator';

export class ProgressDto {
  @IsNumber()
  round: number;

  @IsNumber()
  score: number;

  @IsNumber()
  @Min(1)
  @Max(3)
  stars: number;
}
