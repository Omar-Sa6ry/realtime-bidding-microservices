import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { Transactional } from 'typeorm-transactional';
import { I18nService } from 'nestjs-i18n';
import { RedisService } from '@bts-soft/core';
import { User } from './entity/user.entity';
import { UpdateUserDto } from './inputs/UpdateUser.dto';
import { DEFAULT_LIMIT, DEFAULT_PAGE, Role } from '@bidding-micro/shared';
import {
  UserCountPercentageResponse,
  UserResponse,
  UsersResponse,
} from './dto/UserResponse.dto';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

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

    await this.notifyUpdate(user);
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

    await this.notifyUpdate(user);
    return { data: user };
  }

  async findUsers(
    page: number = DEFAULT_PAGE,
    limit: number = DEFAULT_LIMIT,
  ): Promise<UsersResponse> {
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

  async getUsersCount(): Promise<UserCountPercentageResponse> {
    const cacheKey = `user-count`;
    const cachedUser = await this.redisService.get(cacheKey);
    if (cachedUser) return { data: cachedUser as any };

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

    await this.redisService.set(cacheKey, count);
    return { data: count as any };
  }

  @Transactional()
  async update(
    updateUserDto: UpdateUserDto,
    id: string,
  ): Promise<UserResponse> {
    const user = (await this.findById(id))?.data;
    if (!user)
      throw new BadRequestException(await this.i18n.t('user.NOT_FOUND'));

    Object.assign(user, updateUserDto);

    await this.userRepo.save(user);

    const freshUser = await this.userRepo.findOneBy({ id: user.id });
    if (freshUser) await this.notifyUpdate(freshUser);

    return { data: freshUser || user };
  }

  @Transactional()
  async deleteUser(id: string): Promise<UserResponse> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user)
      throw new BadRequestException(await this.i18n.t('user.NOT_FOUND'));

    await this.userRepo.remove(user);
    await this.notifyDelete(user.id, user.email);

    return { message: await this.i18n.t('user.DELETED') };
  }

  @Transactional()
  async editUserRole(id: string): Promise<UserResponse> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user)
      throw new BadRequestException(await this.i18n.t('user.NOT_FOUND'));

    user.role = Role.ADMIN;
    await this.userRepo.save(user);
    await this.notifyUpdate(user);

    return { data: user, message: await this.i18n.t('user.UPDATED') };
  }

  @Transactional()
  async updateBalance(
    userId: string,
    amount: number,
    transactionType: string,
  ): Promise<{ success: boolean; new_balance: number; message: string }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      return { success: false, new_balance: 0, message: 'User not found' };
    }

    let balance = Number(user.balance || 0);
    const parsedAmount = Number(amount);

    if (transactionType === 'deduct') {
      if (balance < parsedAmount) {
        return {
          success: false,
          new_balance: balance,
          message: 'Insufficient balance',
        };
      }
      balance -= parsedAmount;
    } else if (transactionType === 'add') {
      balance += parsedAmount;
    } else {
      return {
        success: false,
        new_balance: balance,
        message: 'Invalid transaction type',
      };
    }

    user.balance = balance;
    await this.userRepo.save(user);
    await this.notifyUpdate(user);

    return {
      success: true,
      new_balance: balance,
      message: 'Balance updated successfully',
    };
  }

  private async notifyUpdate(user: User): Promise<void> {
    await this.redisService.set(`user:${user.id}`, user);
    await this.redisService.set(`user:email:${user.email}`, user);
  }

  private async notifyDelete(userId: string, email: string): Promise<void> {
    await this.redisService.del(`user:${userId}`);
    await this.redisService.del(`user:email:${email}`);
  }
}
