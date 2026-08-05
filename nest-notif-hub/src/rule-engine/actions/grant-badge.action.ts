import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { Action, ActionContext, ActionResult } from './action.interface';
import { EmployeeBadgeEntity } from '../../users/entities/employee-badge.entity';
import { MissionAssignmentEntity } from '../../missions/entities/mission-assignment.entity';
import { BadgeEntity } from '../../badges/entities/badge.entity';
import { NotificationGateway } from '../../websocket/notification.gateway';

// Badge-agnostic on purpose: this action scans the whole badge catalog
// instead of being told which one badge to check (no badgeId param). That
// means exactly one wiring (e.g. MissionCompleted -> GrantBadge) covers
// every badge that exists now or gets added later — adding badge #20 only
// ever means inserting a row into `badges`, never touching event_links.
@Injectable()
export class GrantBadgeAction implements Action {
  readonly actionType = 'GrantBadge';
  readonly requiredPayloadFields = ['employeeId'];
  readonly allowedSourceEvents = ['MissionCompleted']; // badge thresholds are checked against the completed-mission count, which only changes on completion

  constructor(
    @InjectRepository(EmployeeBadgeEntity)
    private readonly badgeGrantRepo: Repository<EmployeeBadgeEntity>,
    @InjectRepository(MissionAssignmentEntity)
    private readonly assignmentRepo: Repository<MissionAssignmentEntity>,
    @InjectRepository(BadgeEntity)
    private readonly badgeCatalogRepo: Repository<BadgeEntity>,
    private readonly notificationGateway: NotificationGateway,
  ) {}

  async execute(
    payload: Record<string, any>,
    params: Record<string, any>,
    context: ActionContext,
  ): Promise<ActionResult> {
    const employeeId = payload.employeeId;

    const badgeGrantRepo = context.manager
      ? context.manager.withRepository(this.badgeGrantRepo)
      : this.badgeGrantRepo;
    const assignmentRepo = context.manager
      ? context.manager.withRepository(this.assignmentRepo)
      : this.assignmentRepo;
    const badgeCatalogRepo = context.manager
      ? context.manager.withRepository(this.badgeCatalogRepo)
      : this.badgeCatalogRepo;

    // Read the current count from the database rather than trusting
    // anything in payload — same reasoning as CheckLevelThresholdAction:
    // the source of truth is what's actually persisted, not a snapshot.
    const completedCount = await assignmentRepo.count({
      where: { employeeId, status: 'COMPLETED' },
    });

    const alreadyGranted = await badgeGrantRepo.find({ where: { employeeId } });
    const grantedBadgeIds = new Set(alreadyGranted.map((g) => g.badgeId));

    const eligibleBadges = await badgeCatalogRepo.find({
      where: { threshold: LessThanOrEqual(completedCount) },
    });
    const newlyEarned = eligibleBadges.filter((b) => !grantedBadgeIds.has(b.id));

    if (newlyEarned.length === 0) {
      return { shouldEmit: false };
    }

    for (const badge of newlyEarned) {
      await badgeGrantRepo.insert({ id: randomUUID(), employeeId, badgeId: badge.id });
    }

    for (const badge of newlyEarned) {
      this.notificationGateway.emitToEmployee(employeeId, 'badge:granted', { badge });
    }

    return {
      shouldEmit: true,
      payload: {
        employeeId,
        badges: newlyEarned.map((b) => ({ id: b.id, name: b.name })),
      },
    };
  }
}
