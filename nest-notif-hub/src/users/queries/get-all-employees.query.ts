import { Order } from '../types/users.types';


export class GetAllEmployeesQuery {
  constructor(
    public readonly level? : boolean,
    public readonly order?: Order
  ) {}
}