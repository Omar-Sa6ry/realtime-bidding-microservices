import { User } from '../entity/user.entity';

export interface IUserRoleState {
  promote(user: User): Promise<User>;
  demote(user: User): Promise<User>;
}
