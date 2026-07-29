import { Prop, Schema, SchemaFactory  } from '@nestjs/mongoose';
import {HydratedDocument} from 'mongoose';



@Schema({ _id: false, collection: 'activity_feed', timestamps: true })
export class ActivityFeedEntry {
  @Prop({ required: true }) _id: string;
  @Prop({ required: true, index: true }) employeeId: string;
  @Prop({ required: true }) eventType: string;
  @Prop({ required: true }) message: string;
  @Prop({ type: Object }) payload: Record<string, any>;
  @Prop({ required: true }) occurredOn: Date;
}

export const ActivityFeedEntrySchema = SchemaFactory.createForClass(ActivityFeedEntry);
export type ActivityFeedEntryDocument = HydratedDocument<ActivityFeedEntry>