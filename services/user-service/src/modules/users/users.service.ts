import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { Transactional } from 'typeorm-transactional';
import { I18nService } from 'nestjs-i18n';
import { RedisService } from '@bts-soft/core';
import { Transaction } from './entity/transaction.entity';
import { User } from './entity/user.entity';
import { UpdateUserDto } from './inputs/UpdateUser.dto';
import {
  Limit,
  Page,
  Role,
  TransactionStatus,
  TransactionType as DBTransactionType,
} from '@bidding-micro/shared';
import {
  UserCountPercentageResponse,
  UserResponse,
  UsersResponse,
} from './dto/UserResponse.dto';
import { TransactionType } from './interfaces/ItransactionType.interface';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly i18n: I18nService,
    private readonly redisService: RedisService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
  ) {}

  async findById(id: string): Promise<UserResponse> {
    const cacheKey = `user:${id}`;
    const cachedUser: any = await this.redisService.get(cacheKey);
    if (cachedUser) {
      const data = cachedUser.data || cachedUser;
      return { success: true, statusCode: 200, data: data as User };
    }

    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(await this.i18n.t('user.NOT_FOUND'));

    await this.notifyUpdate(user);
    return { success: true, statusCode: 200, data: user };
  }

  async findByIds(ids: string[]): Promise<User[]> {
    if (!ids || ids.length === 0) return [];
    return await this.userRepo.find({
      where: { id: In(ids) },
    });
  }

  async findByEmail(email: string): Promise<UserResponse> {
    const cacheKey = `user:email:${email}`;
    const cachedUser = await this.redisService.get(cacheKey);

    if (cachedUser) {
      const data = (cachedUser as any).data || cachedUser;
      return { success: true, statusCode: 200, data: data as User };
    }

    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) throw new NotFoundException(await this.i18n.t('user.NOT_FOUND'));

    await this.notifyUpdate(user);
    return { success: true, statusCode: 200, data: user };
  }

  async findUsers(
    page: number = Page,
    limit: number = Limit,
  ): Promise<UsersResponse> {
    const [items, total] = await this.userRepo.findAndCount({
      where: { role: Role.USER },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      success: true,
      statusCode: 200,
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
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserResponse> {
    const user = (await this.findById(id)).data;

    const finalUser = await this.userRepo.save({ ...user, ...updateUserDto });
    await this.notifyUpdate(finalUser);

    return {
      success: true,
      statusCode: 200,
      data: finalUser,
      message: await this.i18n.t('user.UPDATED'),
    };
  }

  @Transactional()
  async updateBalance(
    userId: string,
    amount: number,
    transactionType: TransactionType,
  ): Promise<{ success: boolean; new_balance: number; message: string }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user)
      return {
        success: false,
        new_balance: 0,
        message: await this.i18n.t('user.NOT_FOUND'),
      };

    let balance = Number(user.balance || 0);
    const parsedAmount = Number(amount);
    let dbType: DBTransactionType;

    if (transactionType === TransactionType.DEDUCT) {
      if (balance < parsedAmount) {
        return {
          success: false,
          new_balance: balance,
          message: await this.i18n.t('user.INSUFFICIENT_BALANCE'),
        };
      }
      balance -= parsedAmount;
      dbType = DBTransactionType.DEBIT;
    } else if (transactionType === TransactionType.ADD) {
      balance += parsedAmount;
      dbType = DBTransactionType.CREDIT;
    } else {
      return {
        success: false,
        new_balance: balance,
        message: await this.i18n.t('user.INVALID_TRANSACTION_TYPE'),
      };
    }

    user.balance = balance;
    await this.userRepo.save(user);

    const transaction = this.transactionRepo.create({
      userId,
      amount: parsedAmount,
      type: dbType,
      status: TransactionStatus.COMPLETED,
      description:
        transactionType === TransactionType.DEDUCT
          ? 'Bid placement'
          : 'Bid refund / Auction settlement',
    });
    await this.transactionRepo.save(transaction);

    await this.notifyUpdate(user);

    return {
      success: true,
      new_balance: balance,
      message: await this.i18n.t('user.BALANCE_UPDATED'),
    };
  }

  @Transactional()
  async editUserRole(id: string): Promise<UserResponse> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(await this.i18n.t('user.NOT_FOUND'));

    user.role = Role.ADMIN;
    await this.userRepo.save(user);
    await this.notifyUpdate(user);

    return { data: user, message: await this.i18n.t('user.UPDATED') };
  }

  @Transactional()
  async deleteUser(id: string): Promise<UserResponse> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(await this.i18n.t('user.NOT_FOUND'));

    await this.userRepo.remove(user);
    await this.notifyDelete(user.id, user.email);

    return { message: await this.i18n.t('user.DELETED') };
  }

  @Transactional()
  async chargeMoney(userId: string, amount: number) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user)
      return {
        success: false,
        new_balance: 0,
        message: await this.i18n.t('user.NOT_FOUND'),
      };

    user.balance = Number(user.balance) + amount;
    await this.userRepo.save(user);

    const transaction = this.transactionRepo.create({
      userId,
      amount,
      type: DBTransactionType.CREDIT,
      status: TransactionStatus.COMPLETED,
      description: 'Wallet recharge',
    });
    await this.transactionRepo.save(transaction);

    await this.notifyUpdate(user);

    return {
      success: true,
      new_balance: user.balance,
      message: await this.i18n.t('user.BALANCE_UPDATED'),
    };
  }

  private async notifyUpdate(user: User): Promise<void> {
    this.redisService.set(`user:${user.id}`, user);
    this.redisService.set(`user:email:${user.email}`, user);
  }

  private async notifyDelete(userId: string, email: string): Promise<void> {
    this.redisService.del(`user:${userId}`);
    this.redisService.del(`user:email:${email}`);
  }
}
