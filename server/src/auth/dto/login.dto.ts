import { IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  anonymousCode?: string;
}
