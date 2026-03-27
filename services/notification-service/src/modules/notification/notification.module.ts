import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationSubService } from './notification.service';
import { NotificationResolver } from './notification.resolver';
import { Notification, NotificationSchema } from './entity/notification.entity';
import { UserService } from '../user/user.service';
import { AuthCommonModule } from '@bidding-micro/shared';
import { TranslationModule } from 'src/common/translation/translation.module';
import { RedisModule } from '@bts-soft/cache';
import { NotificationModule } from '@bts-soft/notifications';
import { AuctionService } from '../auction/auction.service';
import { GrpcClientsModule } from '../grpc/grpc-clients.module';
import { NotificationController } from './notification.controller';
import { NotificationStrategyFactory } from './strategies/notification-strategy.factory';
import { BidCreatedStrategy } from './strategies/bid-created.strategy';
import { OutbidStrategy } from './strategies/outbid.strategy';
import { AuctionEndedStrategy } from './strategies/auction-ended.strategy';
import { BidWonStrategy } from './strategies/bid-won.strategy';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
    ]),

    TranslationModule,
    GrpcClientsModule,

    AuthCommonModule.register({
      userService: UserService,
      imports: [
        MongooseModule.forFeature([
          { name: Notification.name, schema: NotificationSchema },
        ]),
        RedisModule,
        TranslationModule,
        GrpcClientsModule,
      ],
    }),

    NotificationModule,
  ],
  
  providers: [
    NotificationSubService,
    NotificationResolver,
    AuctionService,
    NotificationStrategyFactory,
    BidCreatedStrategy,
    OutbidStrategy,
    AuctionEndedStrategy,
    BidWonStrategy,
  ],

  controllers: [NotificationController],
})
export class NotificationSubModule {}
