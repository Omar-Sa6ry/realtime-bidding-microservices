import {
  UserResponse,
  UserCountPercentageResponse,
  CountUserResponse,
} from '../dto/UserResponse.dto';
import { I18nService } from 'nestjs-i18n';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { User } from 'src/modules/users/entity/user.entity';
import { Limit, Page } from 'src/common/constant/messages.constant';
import { Role } from 'src/common/constant/enum.constant';
import { Injectable, NotFoundException } from '@nestjs/common';
import { RedisService } from '@bts-soft/core';

@Injectable()
export class UserProxy {
  constructor(
    private readonly i18n: I18nService,
    private readonly redisService: RedisService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async findById(id: string): Promise<UserResponse> {
    const cacheKey = `user:${id}`;

    const cachedUser: any = await this.redisService.get(cacheKey);
    if (cachedUser) {
      const data = cachedUser.data || cachedUser;
      return { data: data as User };
    }

    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(await this.i18n.t('user.NOT_FOUND'));

    this.redisService.set(cacheKey, user);
    this.redisService.set(`user:email:${user.email}`, user);

    return { data: user };
  }

  async findByEmail(email: string): Promise<UserResponse> {
    const cacheKey = `user:email:${email}`;
    const cachedUser = await this.redisService.get(cacheKey);

    if (cachedUser) {
      const data = (cachedUser as any).data || cachedUser;
      return { data: data as User };
    }

    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) throw new NotFoundException(await this.i18n.t('user.NOT_FOUND'));

    this.redisService.set(cacheKey, user);
    this.redisService.set(`user:id:${user.id}`, user);

    return { data: user };
  }

  async findUsers(
    page: number = Page,
    limit: number = Limit,
  ): Promise<CountUserResponse> {
    const [items, total] = await this.userRepo.findAndCount({
      where: { role: Role.USER },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items,
      pagination: {
        totalItems: total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // counts
  async getUsersCount(): Promise<UserCountPercentageResponse> {
    const cacheKey = `user-count`;
    const cachedUser = await this.redisService.get(cacheKey);

    if (cachedUser) return { data: cachedUser };

    const totalUsers = await this.userRepo.count({
      where: { role: Role.USER },
    });

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const usersThisMonth = await this.userRepo.count({
      where: {
        role: Role.USER,
        createdAt: MoreThanOrEqual(startOfMonth),
      },
    });

    const usersLastMonth = await this.userRepo.count({
      where: {
        role: Role.USER,
        createdAt:
          MoreThanOrEqual(startOfLastMonth) && LessThanOrEqual(endOfLastMonth),
      },
    });

    const percentageIncrease = usersLastMonth
      ? ((usersThisMonth - usersLastMonth) / usersLastMonth) * 100
      : 100;

    const count = {
      totalUsers,
      usersThisMonth,
      percentageIncrease: Number(percentageIncrease.toFixed(2)),
    };

    this.redisService.set(cacheKey, count);

    return { data: count };
  }
}
