import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { MongooseModule } from '@nestjs/mongoose';
import { join } from 'path';
import { NotificationSubService } from './notification.service';
import { NotificationResolver } from './notification.resolver';
import { Notification, NotificationSchema } from './entity/notification.entity';
import { UserService } from '../user/user.service';
import { AuthCommonModule } from '@bidding-micro/shared';
import { TranslationModule } from 'src/common/translation/translation.module';
import { RedisModule } from '@bts-soft/cache';
import {
  NotificationModule,
  NotificationService,
} from '@bts-soft/notifications';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
    ]),

    ClientsModule.register([
      {
        name: 'GRPC_USER_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'user',
          protoPath: join(process.cwd(), '../../proto/user.proto'),
          url: process.env.USER_GRPC_URL || 'user-srv:50051',
        },
      },
    ]),

    AuthCommonModule.register({
      userService: UserService,
      imports: [
        MongooseModule.forFeature([
          { name: Notification.name, schema: NotificationSchema },
        ]),
        RedisModule,
        TranslationModule,
        ClientsModule.register([
          {
            name: 'GRPC_USER_SERVICE',
            transport: Transport.GRPC,
            options: {
              package: 'user',
              protoPath: join(process.cwd(), '../../proto/user.proto'),
              url: process.env.USER_GRPC_URL || 'user-srv:50051',
            },
          },
        ]),
      ],
    }),

    NotificationModule,
  ],
  providers: [NotificationSubService, NotificationResolver, UserService],
})
export class NotificationSubModule {}
