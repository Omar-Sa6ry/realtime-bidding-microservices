import { Transactional } from 'typeorm-transactional';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { UpdateUserDto } from '../inputs/UpdateUser.dto';
import { UserResponse } from '../dto/UserResponse.dto';
import { I18nService } from 'nestjs-i18n';
import { Repository } from 'typeorm';
import { User } from '../entity/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { UserProxy } from '../proxy/user.proxy';
import { UserFactory } from '../factory/user.factory';
import { CacheObserver } from '../observer/user.observer';
import { UserRoleContext } from '../state/user.state';
import { RedisService } from '@bts-soft/core';
import { UploadService } from '@bts-soft/upload';

@Injectable()
export class UserFacadeService {
  private readonly logger = new Logger(UserFacadeService.name);
  private observers: CacheObserver;

  constructor(
    private readonly i18n: I18nService,
    private readonly proxy: UserProxy,
    private readonly redisService: RedisService,
    private readonly uploadService: UploadService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Request)
    private readonly requestRepo: Repository<Request>,
  ) {
    this.observers = new CacheObserver(this.redisService);
  }

  @Transactional()
  async update(
    updateUserDto: UpdateUserDto,
    id: string,
  ): Promise<UserResponse> {
    const user = (await this.proxy.findById(id))?.data;
    if (!user)
      throw new BadRequestException(await this.i18n.t('user.NOT_FOUND'));

    if (updateUserDto.avatar) {
      const oldPath = user.avatar;
      const filename = await this.uploadService.uploadImage(
        updateUserDto.avatar,
      );

      if (typeof filename === 'string') {
        try {
          if (oldPath) await this.uploadService.deleteImage(oldPath);
        } catch (e) {
          this.logger.warn(
            `Failed to delete old avatar ${oldPath}: ${e.message}`,
          );
        }
        UserFactory.update(user, updateUserDto, filename);
      } else {
        UserFactory.update(user, updateUserDto);
      }
    } else {
      UserFactory.update(user, updateUserDto);
    }

    await this.userRepo.save(user);

    // Refetch full user to ensure we have all fields for cache
    const freshUser = await this.userRepo.findOneBy({ id: user.id });
    this.notifyUpdate(freshUser || user);

    return { data: user };
  }

  @Transactional()
  async deleteUser(id: string): Promise<UserResponse> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user)
      throw new BadRequestException(await this.i18n.t('user.NOT_FOUND'));

    if (user.avatar) await this.uploadService.deleteImage(user.avatar);
    await this.userRepo.remove(user);
    await this.notifyDelete(user.id, user.email);

    return { message: await this.i18n.t('user.DELETED') };
  }

  @Transactional()
  async editUserRole(id: string): Promise<UserResponse> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user)
      throw new BadRequestException(await this.i18n.t('user.NOT_FOUND'));

    const roleContext = new UserRoleContext(user);
    await roleContext.promote(user);
    await this.userRepo.save(user);
    await this.notifyUpdate(user);

    return { data: user, message: await this.i18n.t('user.UPDATED') };
  }

  private async notifyUpdate(user: User): Promise<void> {
    await this.observers.onUserUpdate(user);
  }

  private async notifyDelete(userId: string, email: string): Promise<void> {
    await this.observers.onUserDelete(userId, email);
  }
}
