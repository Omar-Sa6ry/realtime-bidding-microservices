import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { UserService } from './users.service';
import { UserEvents } from '@bidding-micro/shared';

@Controller()
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

  @MessagePattern(UserEvents.GET_USER_BY_ID)
  async getUserById(@Payload() data: { id: string }) {
    return await this.userService.findById(data.id);
  }

  @MessagePattern(UserEvents.GET_USER_BY_EMAIL)
  async getUserByEmail(@Payload() data: { email: string }) {
    return await this.userService.findByEmail(data.email);
  }
}
