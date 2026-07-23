import { HydratedDocument } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type EmployeeProjectionDocument = HydratedDocument<EmployeeProjection>;

@Schema({_id: false , collection : 'employee_projections' , timestamps : true} )
export class EmployeeProjection {
  @Prop({ required: true })
  _id: string;

  @Prop()
  name: string;

  @Prop({ unique: true, sparse: true })
  email: string;

  @Prop({ unique: true, sparse: true })
  phone: string;

  @Prop({ default: 0 })
  xp: number;

  @Prop({ default: 1 })
  level: number;
}

export const EmployeeProjectionSchema = SchemaFactory.createForClass(EmployeeProjection);