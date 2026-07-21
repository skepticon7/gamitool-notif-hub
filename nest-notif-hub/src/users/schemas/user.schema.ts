import { HydratedDocument } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type UserDocument = HydratedDocument<User>

@Schema({
  collection: 'users',
  timestamps: true,
})
export class User {
  @Prop({
    unique: true,
  })
  sub: string;

  @Prop()
  email: string;

  @Prop()
  name: string;
}

export const UserSchema = SchemaFactory.createForClass(User);