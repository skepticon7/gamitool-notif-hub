import { Controller, Get } from '@nestjs/common';
import { ActionRegistry } from '../../rule-engine/actions/action-registry';

@Controller('admin/actions')
export class ActionsController {
  constructor(private readonly actionRegistry: ActionRegistry) {}

  @Get()
  findAll() {
    return this.actionRegistry.list();
  }
}
