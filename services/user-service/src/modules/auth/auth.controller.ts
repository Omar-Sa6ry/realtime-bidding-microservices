import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { AuthServiceFacade } from './fascade/AuthService.facade';
import { CreateUserDto } from './inputs/CreateUserData.dto';
import { LoginDto } from './inputs/Login.dto';

@Controller()
export class AuthGrpcController {
  constructor(private readonly authFacade: AuthServiceFacade) {}

  @GrpcMethod('UserService', 'Register')
  async register(data: CreateUserDto) {
    const result = await this.authFacade.register(data);
    return {
      user: result.data?.user,
      token: result.data?.token,
    };
  }

  @GrpcMethod('UserService', 'Login')
  async login(data: LoginDto) {
    const result = await this.authFacade.login(data);
    return {
      user: result.data?.user,
      token: result.data?.token,
    };
  }
}
