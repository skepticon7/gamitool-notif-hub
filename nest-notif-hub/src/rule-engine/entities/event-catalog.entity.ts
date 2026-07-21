import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('event_catalog')
export class EventCatalogEntity {
  // The event type name IS the identity here — e.g. "MissionCompleted".
  // No surrogate id: nothing ever needs to reference a catalog row except
  // by this name, and EventLinkEntity.sourceEvent/targetEvent store it directly.
  @PrimaryColumn()
  eventType: string;

  // Documents the shape admins can expect in payload when wiring rules
  // against this event in the admin panel. Not validated at runtime (yet) —
  // purely descriptive metadata for the Wiring UI's forms.
  @Column('json')
  payloadFields: Record<string, string>;
}
