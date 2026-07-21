import { Injectable } from '@nestjs/common';
import { Action, ActionResult } from './action.interface';

@Injectable()
export class EmitEventAction implements Action {
  actionType: string = "EmitEvent";
  execute(
    payload: Record<string, any>,
    params: Record<string, any>,
  ): Promise<ActionResult> | ActionResult {
    return {shouldEmit : true , payload}
  }
}