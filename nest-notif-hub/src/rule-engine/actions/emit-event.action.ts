import { Injectable } from '@nestjs/common';
import { Action, ActionResult } from './action.interface';

@Injectable()
export class EmitEventAction implements Action {
  actionType: string = "EmitEvent";
  readonly requiredPayloadFields: string[] = []; // pure passthrough, no requirements
  readonly allowedSourceEvents: string[] = ['*']; // genuinely generic — chains any event into any other by design
  execute(
    payload: Record<string, any>,
    params: Record<string, any>,
  ): Promise<ActionResult> | ActionResult {
    return {shouldEmit : true , payload}
  }
}