import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetMyActivityFeedQuery } from '../queries/get-my-activity-feed.query';
import { InjectModel } from '@nestjs/mongoose';
import {
  ActivityFeedEntry,
  ActivityFeedEntryDocument,
} from '../schemas/activity-feed-entry.schema';
import { Model } from 'mongoose';

@QueryHandler(GetMyActivityFeedQuery)
export class GetMyActivityFeedHandler implements IQueryHandler<GetMyActivityFeedQuery> {

  constructor(
    @InjectModel(ActivityFeedEntry.name)
    private readonly activityModel: Model<ActivityFeedEntryDocument>,
  ) {}

  execute(query: GetMyActivityFeedQuery): Promise<any> {
    return this.activityModel.find({employeeId: query.employeeId}).sort({occurredOn: -1}).limit(5);
  }

}