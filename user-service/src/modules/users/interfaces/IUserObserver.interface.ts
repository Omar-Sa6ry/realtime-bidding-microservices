import { User } from 'src/modules/users/entity/user.entity';

export interface IUserObserver {
  onUserUpdate(user: User): Promise<void>;
  onUserDelete(userId: string, email: string): Promise<void>;
}
