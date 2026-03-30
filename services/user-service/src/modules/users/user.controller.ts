import { Controller, UseFilters } from '@nestjs/common';
import { GrpcMethod, MessagePattern, Payload } from '@nestjs/microservices';
import { UserService } from './users.service';
import { UserEvents, GrpcExceptionFilter } from '@bidding-micro/shared';
import { TransactionType } from './interfaces/ItransactionType.interface';

@Controller()
@UseFilters(GrpcExceptionFilter)
export class UserNatsController {
  constructor(private readonly userService: UserService) {}

  @MessagePattern('user.exists')
  async handleUserExists(@Payload() data: { id: string }) {
    try {
      const user = await this.userService.findById(data.id);
      return { exists: true, user: user.data };
    } catch {
      return { exists: false };
    }
  }

  @MessagePattern('bid.outbid')
  async handleOutbid(@Payload() data: { userId: string; amount: number }) {
    this.userService.updateBalance(
      data.userId,
      data.amount,
      TransactionType.ADD,
    );
  }

  @MessagePattern(UserEvents.GET_USER_BY_ID)
  async getUserById(@Payload() data: { id: string }) {
    return await this.userService.findById(data.id);
  }

  @MessagePattern(UserEvents.GET_USER_BY_EMAIL)
  async getUserByEmail(@Payload() data: { email: string }) {
    return await this.userService.findByEmail(data.email);
  }

  @GrpcMethod('UserService', 'GetUser')
  async getUser(data: { id: string }) {
    const user = await this.userService.findById(data.id);
    return {
      user: {
        id: user?.data?.id,
        email: user?.data?.email,
        balance: Number(user?.data?.balance),
        firstname: user?.data?.firstName,
        lastname: user?.data?.lastName,
        role: user?.data?.role,
        country: user?.data?.country,
      },
    };
  }

  @GrpcMethod('UserService', 'GetUsers')
  async getUsers(data: { ids: string[] }) {
    const users = await this.userService.findByIds(data.ids);
    return {
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        balance: Number(u.balance),
        firstname: u.firstName,
        lastname: u.lastName,
        role: u.role,
        country: u.country,
      })),
    };
  }

  @GrpcMethod('UserService', 'UpdateBalance')
  async updateBalance(data: {
    user_id: string;
    amount: number;
    transaction_type: TransactionType;
  }) {
    return await this.userService.updateBalance(
      data.user_id,
      data.amount,
      data.transaction_type,
    );
  }
}
