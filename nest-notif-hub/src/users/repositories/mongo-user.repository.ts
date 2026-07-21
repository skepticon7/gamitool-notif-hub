import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import { Model } from 'mongoose';
import { MongoServerError } from 'mongodb';
import { BusinessException } from '../../shared/exceptions/business.exception';

@Injectable()
export class MongoUserRepository {
  constructor(
    @InjectModel(User.name)
    private readonly model: Model<UserDocument>,
  ) {}

  findBySub(sub: string) : Promise<UserDocument | null> {
    return this.model.findOne({ sub }).exec();
  }

  async create(user: Partial<User>) {
    try {
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        throw new BusinessException(
          'MONGO_DUPLICATE_ENTRY',
          'User already exists',
          HttpStatus.CONFLICT,
        );
      }

      throw new BusinessException(
        'MONGO_ERROR',
        error instanceof Error ? error.message : 'Unknown mongoDB error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}