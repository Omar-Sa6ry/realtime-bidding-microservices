import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { Inject, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { AuthResponse, UserResponse } from './dto/user.type';
import { RegisterInput, LoginInput } from './dto/user.input';
import { UserServiceClient } from './interfaces/user-service.interface';
import { firstValueFrom } from 'rxjs';

@Resolver()
export class UserResolver implements OnModuleInit {
  private userService: UserServiceClient;

  constructor(@Inject('USER_PACKAGE') private client: ClientGrpc) {}

  onModuleInit() {
    this.userService = this.client.getService<UserServiceClient>('UserService');
  }

  @Query(() => String)
  healthCheck() {
    return 'API Gateway is healthy';
  }

  @Query(() => UserResponse)
  async getUser(@Args('id') id: string) {
    const response = await firstValueFrom(this.userService.getUser({ id }));
    return {
      data: response.user,
      message: 'User fetched successfully',
      statusCode: 200,
    };
  }

  @Mutation(() => AuthResponse)
  async register(@Args('input') input: RegisterInput) {
    const response = await firstValueFrom(this.userService.register(input));
    return {
      data: response,
      message: 'User registered successfully',
      statusCode: 201,
    };
  }

  @Mutation(() => AuthResponse)
  async login(@Args('input') input: LoginInput) {
    const response = await firstValueFrom(this.userService.login(input));
    return {
      data: response,
      message: 'User logged in successfully',
      statusCode: 200,
    };
  }
}
