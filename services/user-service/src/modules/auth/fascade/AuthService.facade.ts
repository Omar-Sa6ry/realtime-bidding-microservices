import { BadRequestException, Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { UserService } from '../../users/users.service';
import { TokenService } from '../jwt/jwt.service';
import { User } from '../../users/entity/user.entity';
import { AuthResponse } from '../dto/AuthRes.dto';
import { LoginDto } from '../inputs/Login.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from '../inputs/CreateUserData.dto';
import { Role } from '@bidding-micro/shared';
import { PasswordServiceAdapter } from '../adapter/password.adapter';
import { Transactional } from 'typeorm-transactional';
import { RedisService } from '@bts-soft/core';
import {
  PasswordValidator,
  RoleValidator,
} from '../composite/validator.composite';

@Injectable()
export class AuthServiceFacade {
  constructor(
    private readonly i18n: I18nService,
    private readonly userService: UserService,
    private readonly tokenService: TokenService,
    private readonly passwordAdapter: PasswordServiceAdapter,
    private readonly redisService: RedisService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  @Transactional()
  async register(createUserDto: CreateUserDto): Promise<AuthResponse> {
    console.log('===> REGISTRATION STARTED WITH:', createUserDto);
    const user = await this.createUser(createUserDto);

    const token = await this.tokenService.generate(user.email, user.id);

    this.redisService.set(`user:${user.id}`, user);
    this.redisService.set(`user:email:${user.email}`, user);

    const cachedUser = await this.redisService.get(`user-count`);
    if (cachedUser) this.redisService.set(`user-count`, +cachedUser + 1);

    return {
      message: await this.i18n.t('user.REGISTER'),
      data: {
        user,
        token,
      },
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const userCacheKey = `auth:${loginDto.email}`;
    const cachedUser = await this.redisService.get(userCacheKey);

    if (cachedUser instanceof AuthResponse) {
      return { ...cachedUser };
    }

    const { email, password } = loginDto;
    const user = await this.userService.findByEmail(email);
    if (!user?.data)
      throw new BadRequestException(await this.i18n.t('user.NOT_FOUND'));

    const isValid = await this.passwordAdapter.compare(
      password,
      user?.data?.password || '',
    );
    if (!isValid) throw new BadRequestException('Invalid credentials');

    const expiresIn = loginDto.rememberMe ? '100y' : undefined;
    const token = await this.tokenService.generate(
      user?.data?.email,
      user.data?.id,
      expiresIn,
    );

    this.userRepo.save(user.data);

    this.redisService.set(`user:${user.data.id}`, user.data);
    this.redisService.set(`user:email:${user.data.email}`, user.data);
    return {
      data: { user: user.data, token },
      message: await this.i18n.t('user.LOGIN'),
    };
  }

  async roleBasedLogin(loginDto: LoginDto, role: Role): Promise<AuthResponse> {
    const { email, password } = loginDto;
    const user = await this.userService.findByEmail(email);
    if (!user?.data)
      throw new BadRequestException(await this.i18n.t('user.NOT_FOUND'));

    const passwordValidator = new PasswordValidator(
      this.i18n,
      this.passwordAdapter,
      password,
    );
    const roleValidator = new RoleValidator(this.i18n, role);

    await roleValidator.validate(user.data);
    await passwordValidator.validate(user.data);

    const token = await this.tokenService.generate(
      user.data.email,
      user.data.id,
    );

    await this.userRepo.save(user.data);

    this.redisService.set(`user:${user.data.id}`, user.data);
    this.redisService.set(`user:email:${user.data.email}`, user.data);
    return {
      data: { user: user.data, token },
      message: await this.i18n.t('user.LOGIN'),
    };
  }

  @Transactional()
  private async createUser(createUserDto: CreateUserDto): Promise<User> {
    const checkIfEmailExisted = await this.userRepo.findOne({
      where: { email: createUserDto.email },
    });

    if (checkIfEmailExisted)
      throw new BadRequestException(await this.i18n.t('user.EMAIL_EXISTED'));

    const password = await this.passwordAdapter.hash(createUserDto.password);



    const user = await this.userRepo.create({ ...createUserDto, password });
    await this.userRepo.save(user);

    return user;
  }


}
