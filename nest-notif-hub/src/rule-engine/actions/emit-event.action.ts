import { Injectable } from '@nestjs/common';
import { Action, ActionResult } from './action.interface';

@Injectable()
export class EmitEventAction implements Action {
  actionType: string = "EmitEvent";
  readonly requiredPayloadFields: string[] = []; // pure passthrough, no requirements
  execute(
    payload: Record<string, any>,
    params: Record<string, any>,
  ): Promise<ActionResult> | ActionResult {
    return {shouldEmit : true , payload}
  }
}