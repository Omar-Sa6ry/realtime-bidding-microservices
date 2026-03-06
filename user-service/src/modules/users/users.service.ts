import { UserProxy } from 'src/modules/users/proxy/user.proxy';
import { Injectable } from '@nestjs/common';
import { IUserObserver } from './interfaces/IUserObserver.interface';
import { CacheObserver } from './observer/user.observer';
import { Limit, Page } from 'src/common/constant/messages.constant';
import { RedisService } from '@bts-soft/core';
import {
  CountUserResponse,
  UserCountPercentageResponse,
  UserResponse,
} from './dto/UserResponse.dto';

@Injectable()
export class UserService {
  private observers: IUserObserver[] = [];

  constructor(
    private readonly redisService: RedisService,
    private readonly proxy: UserProxy,
  ) {
    this.observers.push(new CacheObserver(this.redisService));
  }

  async findById(id: string): Promise<UserResponse> {
    return this.proxy.findById(id);
  }

  async findByEmail(email: string): Promise<UserResponse> {
    return this.proxy.findByEmail(email);
  }

  async findUsers(
    page: number = Page,
    limit: number = Limit,
  ): Promise<CountUserResponse> {
    return this.proxy.findUsers(page, limit);
  }

  async getUsersCount(): Promise<UserCountPercentageResponse> {
    return this.proxy.getUsersCount();
  }
}
