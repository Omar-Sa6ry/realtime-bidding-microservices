import { User } from '../../users/entity/user.entity';

export interface IPasswordResetState {
  handle(user: User, token: string): Promise<void>;
}
