import { Injectable } from '@nestjs/common';
import { UserService } from '../../user/user.service';
import { IUser } from '@bidding-micro/shared';

export interface IUserClient {
  getUserByUserId(userId: string): Promise<IUser>;
}

@Injectable()
export class UserClientAdapter implements IUserClient {
  constructor(private readonly userService: UserService) {}

  async getUserByUserId(userId: string): Promise<IUser> {
    return this.userService.findById(userId);
  }
}
