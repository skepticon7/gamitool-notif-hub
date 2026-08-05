import type { BadgeTier } from '../entities/badge.entity';

export class CreateBadgeCommand {
  constructor(
    public readonly name: string,
    public readonly threshold: number,
    public readonly tier: BadgeTier,
    public readonly description?: string,
  ) {}
}
