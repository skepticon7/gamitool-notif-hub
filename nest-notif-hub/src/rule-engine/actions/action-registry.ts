import { Inject, Injectable } from '@nestjs/common';
import { Action } from './action.interface';

// Multi-provider token: each concrete Action registers itself here in
// rule-engine.module.ts's providers array, so ActionRegistry never needs
// to know the list of action classes directly.
export const ACTION_PROVIDERS = Symbol('ACTION_PROVIDERS');

@Injectable()
export class ActionRegistry {
  private readonly actions = new Map<string, Action>();

  constructor(@Inject(ACTION_PROVIDERS) actions: Action[]) {
    for (const action of actions) {
      this.actions.set(action.actionType, action);
    }
  }

  get(actionType: string): Action {
    const action = this.actions.get(actionType);
    if (!action) {
      throw new Error(`No action registered for type "${actionType}"`);
    }
    return action;
  }

  // Lets the admin API expose real registered action types (e.g. for a
  // dropdown) instead of a hardcoded list that can drift from the code.
  list(): string[] {
    return Array.from(this.actions.keys());
  }
}
