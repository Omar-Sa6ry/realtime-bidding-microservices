import { Injectable, Inject, NotFoundException, OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { I18nService } from 'nestjs-i18n';
import { IUser } from '@bidding-micro/shared';

interface UserGrpcService {
  getUser(data: { id: string }): import('rxjs').Observable<any>;
}

@Injectable()
export class UserService implements OnModuleInit {
  private userGrpcService: UserGrpcService;

  constructor(
    private readonly i18n: I18nService,
    @Inject('GRPC_USER_SERVICE') private client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.userGrpcService = this.client.getService<UserGrpcService>('UserService');
  }

  async findById(userId: string): Promise<IUser> {
    try {
      const response = await lastValueFrom(
        this.userGrpcService.getUser({ id: userId }),
      );

      if (!response || !response.user) {
        throw new NotFoundException(this.i18n.t('notification.USER_NOT_FOUND'));
      }

      return response.user as IUser;
    } catch (error) {
      throw new NotFoundException(this.i18n.t('notification.USER_NOT_FOUND'));
    }
  }
}
