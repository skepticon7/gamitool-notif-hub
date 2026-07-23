import { EntityManager } from 'typeorm';

export interface ActionResult {
  // Whether the consumer should write a new outbox row for the rule's
  // targetEvent. False for actions with no downstream event (e.g. a
  // notification that just enqueues a job and stops).
  shouldEmit: boolean;
  payload?: Record<string, any>;
}

export interface ActionContext {
  // The RuleEngineConsumer's transaction — MySQL-only actions (GrantXP,
  // CheckLevelThreshold) should use it for their own writes so those writes
  // commit/roll back atomically with the emitted event and the dedupe mark.
  // Actions with a non-MySQL side effect (NotifyAction enqueuing to BullMQ)
  // can't be made safe this way and should ignore it.
  manager?: EntityManager;
  // Identify which (event, rule) pair this execution belongs to — needed
  // by actions that must build a deterministic ID themselves (e.g. a BullMQ
  // jobId) since their side effect can't be protected by `manager`'s
  // transaction the way a MySQL write can.
  eventId: string;
  ruleId: string;
  correlationId: string;
}

export interface Action {
  // Matches EventLinkEntity.action — this is the string RuleEngineConsumer
  // looks up in ActionRegistry to find this action.
  readonly actionType: string;

  // Declared contract: which payload fields this action reads. Checked at
  // event_link wiring time (EventLinkGraphValidator) against the chosen
  // sourceEvent's declared event_catalog.payloadFields — this is what turns
  // "admin can wire anything" into "admin can wire anything that type-checks".
  readonly requiredPayloadFields: string[];

  execute(
    payload: Record<string, any>,
    params: Record<string, any>,
    context: ActionContext,
  ): Promise<ActionResult> | ActionResult;
}
