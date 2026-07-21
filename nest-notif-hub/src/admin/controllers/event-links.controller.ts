import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventLinkEntity } from '../../rule-engine/entities/event-link.entity';
import { RulesCache } from '../../rule-engine/services/rules-cache';
import { CreateEventLinkDto } from '../dto/create-event-link.dto';
import { UpdateEventLinkDto } from '../dto/update-event-link.dto';

// RuleEngineConsumer reads rules from RulesCache, an in-memory map — not
// from this table directly. Every mutation here calls rulesCache.reload()
// afterward, so the change is live before the response is even returned.
// Single app instance, so a direct method call is enough — no need for a
// pub/sub signal to coordinate other processes that don't exist.
@Controller('admin/event-links')
export class EventLinksController {
  constructor(
    @InjectRepository(EventLinkEntity)
    private readonly repo: Repository<EventLinkEntity>,
    private readonly rulesCache: RulesCache,
  ) {}

  @Get()
  findAll(@Query('sourceEvent') sourceEvent?: string) {
    return this.repo.find(sourceEvent ? { where: { sourceEvent } } : {});
  }

  @Post()
  async create(@Body() dto: CreateEventLinkDto) {
    const saved = await this.repo.save(
      this.repo.create({ ...dto, targetEvent: dto.targetEvent ?? null }),
    );
    await this.rulesCache.reload();
    return saved;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateEventLinkDto) {
    const existing = await this.repo.findOneBy({ id });
    if (!existing) throw new NotFoundException(`event_links row ${id} not found`);

    await this.repo.update(id, dto);
    await this.rulesCache.reload();
    return this.repo.findOneBy({ id });
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.repo.delete(id);
    await this.rulesCache.reload();
    return { deleted: true };
  }
}
