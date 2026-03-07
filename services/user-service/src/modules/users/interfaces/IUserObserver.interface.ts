import { User } from '../entity/user.entity';

export interface IUserObserver {
  onUserUpdate(user: User): Promise<void>;
  onUserDelete(userId: string, email: string): Promise<void>;
}
