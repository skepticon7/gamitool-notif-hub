import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import type { BadgeTier } from '../../badges/entities/badge.entity';

const BADGE_TIERS: BadgeTier[] = ['bronze', 'silver', 'gold', 'diamond'];

export class UpdateBadgeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  threshold?: number;

  @IsOptional()
  @IsIn(BADGE_TIERS)
  tier?: BadgeTier;

  @IsOptional()
  @IsString()
  description?: string;
}
