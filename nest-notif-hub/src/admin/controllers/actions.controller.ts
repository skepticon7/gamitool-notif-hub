import { Controller, Get, UseGuards } from '@nestjs/common';
import { ActionRegistry } from '../../rule-engine/actions/action-registry';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';

@Controller('admin/actions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class ActionsController {
  constructor(private readonly actionRegistry: ActionRegistry) {}

  @Get()
  findAll() {
    return this.actionRegistry.listWithMetadata();
  }
}
