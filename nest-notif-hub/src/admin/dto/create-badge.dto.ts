import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import type { BadgeTier } from '../../badges/entities/badge.entity';

const BADGE_TIERS: BadgeTier[] = ['bronze', 'silver', 'gold', 'diamond'];

export class CreateBadgeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsInt()
  @Min(1)
  threshold: number;

  @IsIn(BADGE_TIERS)
  tier: BadgeTier;

  @IsOptional()
  @IsString()
  description?: string;
}
