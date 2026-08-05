import type { BadgeTier } from '../entities/badge.entity';

export class UpdateBadgeCommand {
  constructor(
    public readonly id: string,
    public readonly name?: string,
    public readonly threshold?: number,
    public readonly tier?: BadgeTier,
    public readonly description?: string,
  ) {}
}
