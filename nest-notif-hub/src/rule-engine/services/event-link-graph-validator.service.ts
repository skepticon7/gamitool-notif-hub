import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventCatalogEntity } from '../entities/event-catalog.entity';
import { EventLinkEntity } from '../entities/event-link.entity';
import { ActionRegistry } from '../actions/action-registry';
import { BusinessException } from '../../shared/exceptions/business.exception';
import { extractTemplateFields } from '../../notifications/services/interpolate-template';

// Synthesized by NotifyAction from the employee record it looks up itself —
// available to every message template regardless of what the source event's
// payload declares, so it's exempt from the payload-field check below.
const ALWAYS_AVAILABLE_TEMPLATE_FIELDS = ['name'];

export interface EventLinkCandidate {
  sourceEvent: string;
  action: string;
  targetEvent: string | null;
  params?: Record<string, any>;
  // Excluded from the cycle walk — the row being edited shouldn't count as
  // a pre-existing edge when validating its own new shape.
  excludeLinkId?: string;
}

// Runs before any event_links write (create or update). Turns "admin can
// wire anything" into "admin can wire anything that type-checks": rejects
// unknown events/actions, payload incompatibility, and wiring that would
// create a cycle in the sourceEvent -> targetEvent graph.
@Injectable()
export class EventLinkGraphValidator {
  constructor(
    @InjectRepository(EventCatalogEntity)
    private readonly catalogRepo: Repository<EventCatalogEntity>,
    @InjectRepository(EventLinkEntity)
    private readonly linkRepo: Repository<EventLinkEntity>,
    private readonly actionRegistry: ActionRegistry,
  ) {}

  async validate(candidate: EventLinkCandidate): Promise<void> {
    const sourceCatalog = await this.catalogRepo.findOneBy({ eventType: candidate.sourceEvent });
    if (!sourceCatalog) {
      throw new BusinessException(
        'UNKNOWN_SOURCE_EVENT',
        `Event type "${candidate.sourceEvent}" is not registered in event_catalog`,
        HttpStatus.BAD_REQUEST,
      );
    }

    let action;
    try {
      action = this.actionRegistry.get(candidate.action);
    } catch {
      throw new BusinessException(
        'UNKNOWN_ACTION',
        `Action "${candidate.action}" is not registered`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const providedFields = Object.keys(sourceCatalog.payloadFields ?? {});
    const missing = action.requiredPayloadFields.filter((f) => !providedFields.includes(f));
    if (missing.length > 0) {
      throw new BusinessException(
        'INCOMPATIBLE_WIRING',
        `Action "${candidate.action}" requires payload field(s) [${missing.join(', ')}], ` +
          `but event "${candidate.sourceEvent}" only declares [${providedFields.join(', ')}]`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Orthogonal to the field check above: having the right DATA doesn't
    // mean this event is what the action is actually meant to react to
    // (e.g. GrantBadge only needs employeeId, which MissionAssigned has
    // too — but assignment never changes the completed-count GrantBadge
    // checks). This is what actually limits what an admin can wire,
    // developer-curated per action via Action.allowedSourceEvents.
    if (
      !action.allowedSourceEvents.includes('*') &&
      !action.allowedSourceEvents.includes(candidate.sourceEvent)
    ) {
      throw new BusinessException(
        'INCOMPATIBLE_SOURCE_EVENT',
        `Action "${candidate.action}" doesn't make sense wired to "${candidate.sourceEvent}" — ` +
          `it's only meant to react to [${action.allowedSourceEvents.join(', ')}]`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Only Notify's params.message is a template today — this check is
    // specific to that shape, not a generic "validate all params" pass.
    // Catches an admin referencing a field (e.g. {{daysLeft}}) that this
    // particular sourceEvent never declares, which would otherwise silently
    // interpolate to an empty string the first time the rule actually fires
    // — see interpolateTemplate.
    if (candidate.action === 'Notify' && typeof candidate.params?.message === 'string') {
      const referenced = extractTemplateFields(candidate.params.message);
      const unknown = referenced.filter(
        (f) => !providedFields.includes(f) && !ALWAYS_AVAILABLE_TEMPLATE_FIELDS.includes(f),
      );
      if (unknown.length > 0) {
        throw new BusinessException(
          'INCOMPATIBLE_TEMPLATE',
          `Message template references field(s) [${unknown.join(', ')}], but event "${candidate.sourceEvent}" ` +
            `only declares [${providedFields.join(', ')}] (plus always-available: ${ALWAYS_AVAILABLE_TEMPLATE_FIELDS.join(', ')})`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    if (candidate.targetEvent) {
      const targetCatalog = await this.catalogRepo.findOneBy({ eventType: candidate.targetEvent });
      if (!targetCatalog) {
        throw new BusinessException(
          'UNKNOWN_TARGET_EVENT',
          `Event type "${candidate.targetEvent}" is not registered in event_catalog`,
          HttpStatus.BAD_REQUEST,
        );
      }

      await this.assertNoCycle(candidate.sourceEvent, candidate.targetEvent, candidate.excludeLinkId);
    }
  }

  // Walks forward from targetEvent through existing links (excluding the
  // one being edited) — if that walk ever reaches sourceEvent again, this
  // new edge would close a loop that re-triggers itself indefinitely.
  private async assertNoCycle(
    sourceEvent: string,
    targetEvent: string,
    excludeLinkId?: string,
  ): Promise<void> {
    const allLinks = await this.linkRepo.find();
    const edges = allLinks.filter((l) => l.id !== excludeLinkId && l.targetEvent);

    const visited = new Set<string>();
    const stack = [targetEvent];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === sourceEvent) {
        throw new BusinessException(
          'CYCLE_DETECTED',
          `Wiring "${sourceEvent}" -> ... -> "${targetEvent}" would close a loop back to "${sourceEvent}"`,
          HttpStatus.BAD_REQUEST,
        );
      }
      if (visited.has(current)) continue;
      visited.add(current);

      for (const edge of edges) {
        if (edge.sourceEvent === current) {
          stack.push(edge.targetEvent as string);
        }
      }
    }
  }
}
