import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventCatalogEntity } from '../../rule-engine/entities/event-catalog.entity';
import { CreateEventCatalogDto } from '../dto/create-event-catalog.dto';
import { UpdateEventCatalogDto } from '../dto/update-event-catalog.dto';

@Controller('admin/event-catalog')
export class EventCatalogController {
  constructor(
    @InjectRepository(EventCatalogEntity)
    private readonly repo: Repository<EventCatalogEntity>,
  ) {}

  @Get()
  findAll() {
    return this.repo.find();
  }

  @Post()
  create(@Body() dto: CreateEventCatalogDto) {
    return this.repo.save(this.repo.create(dto));
  }

  @Patch(':eventType')
  async update(
    @Param('eventType') eventType: string,
    @Body() dto: UpdateEventCatalogDto,
  ) {
    const existing = await this.repo.findOneBy({ eventType });
    if (!existing) {
      throw new NotFoundException(`event_catalog row "${eventType}" not found`);
    }
    await this.repo.update({ eventType }, dto);
    return this.repo.findOneBy({ eventType });
  }

  @Delete(':eventType')
  async remove(@Param('eventType') eventType: string) {
    await this.repo.delete({ eventType });
    return { deleted: true };
  }
}
