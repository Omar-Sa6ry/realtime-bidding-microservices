import { I18nService } from 'nestjs-i18n';
import { UserService } from 'src/modules/users/users.service';
import { BadRequestException, Injectable } from '@nestjs/common';
import { User } from 'src/modules/users/entity/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthResponse } from './dto/AuthRes.dto';
import { MoreThan, Repository } from 'typeorm';
import { RedisService, NotificationService } from '@bts-soft/core';
import { UserResponse } from '../users/dto/UserResponse.dto';
import { ResetPasswordDto } from './inputs/ResetPassword.dto';
import { PasswordServiceAdapter } from './adapter/password.adapter';
import { ChangePasswordDto } from './inputs/ChangePassword.dto';
import { IPasswordStrategy } from './interfaces/IPassword.interface';
import {
  CompletedResetState,
  InitialResetState,
  PasswordResetContext,
} from './state/auth.state';
import { Transactional } from 'typeorm-transactional';


@Injectable()
export class AuthService {
  private passwordStrategy: IPasswordStrategy;

  constructor(
    private readonly i18n: I18nService,
    private readonly userService: UserService,
    private readonly redisService: RedisService,
    private readonly notificationService: NotificationService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {
    this.passwordStrategy = new PasswordServiceAdapter();
  }

  @Transactional()
  async forgotPassword(email: string): Promise<AuthResponse> {
    const user = (await this.userService.findByEmail(email)).data;
    if (!user)       throw new BadRequestException(await this.i18n.t('user.EMAIL_EXISTED'));

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const resetContext = new PasswordResetContext(new InitialResetState());
    await resetContext.execute(user, otp);
    await this.userRepo.save(user);

    return { message: await this.i18n.t('user.SEND_MSG'), data: null };
  }

  @Transactional()
  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
  ): Promise<UserResponse> {
    const user = await this.validateResetToken(resetPasswordDto.token);
    user.password = await this.passwordStrategy.hash(resetPasswordDto.password);

    const resetContext = new PasswordResetContext(new CompletedResetState());
    await resetContext.execute(user);

    await this.userRepo.save(user);

    this.redisService.set(`user:${user.id}`, user);

    return {
      message: await this.i18n.t('user.UPDATE_PASSWORD'),
      data: user,
    };
  }

  @Transactional()
  async changePassword(
    id: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<UserResponse> {
    if (changePasswordDto.password) {
      if (changePasswordDto.password === changePasswordDto.newPassword)
        throw new BadRequestException(
          await this.i18n.t('user.OLD_IS_EQUAL_NEW'),
        );
    }

    const user = await this.validateUserForPasswordChange(
      id,
      changePasswordDto.password,
    );

    const password = await this.passwordStrategy.hash(
      changePasswordDto.newPassword,
    );

    user.password = password;
    await this.userRepo.save(user);

    return {
      message: await this.i18n.t('user.UPDATE_PASSWORD'),
      data: user,
    };
  }

  // ====================== Private helper methods =====================


  private async validateResetToken(token: string): Promise<User> {
    const user = await this.userRepo.findOne({
      where: {
        resetToken: token,
        resetTokenExpiry: MoreThan(new Date()),
      },
    });

    if (!user)
      throw new BadRequestException(await this.i18n.t('user.NOT_FOUND'));
    return user;
  }

  private async validateUserForPasswordChange(
    id: string,
    currentPassword: string,
  ): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user)
      throw new BadRequestException(await this.i18n.t('user.EMAIL_WRONG'));

    const isMatch = await this.passwordStrategy.compare(
      currentPassword,
      user.password || '',
    );
    if (!isMatch)
      throw new BadRequestException(await this.i18n.t('user.WRONG_PASSWORD'));

    return user;
  }
}
