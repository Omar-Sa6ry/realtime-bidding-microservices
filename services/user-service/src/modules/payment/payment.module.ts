import { Module } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { PaymentController } from './payment.controller';
import { PaymentResolver } from './payment.resolver';
import { UserModule } from '../users/users.module';
import { AuthCommonModule } from '@bidding-micro/shared';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TranslationModule } from '../../common/translation/translation.module';
import { UserService } from '../users/users.service';
import { PaymentService } from './payment.service';
import { RedisModule } from '@bts-soft/core';
import { User } from '../users/entity/user.entity';

@Module({
  imports: [
    UserModule,
    AuthCommonModule.register({
      userService: UserService,
      imports: [
        TypeOrmModule.forFeature([User]),
        RedisModule,
        TranslationModule,
      ],
    }),
  ],
  providers: [
    StripeService,
    PaymentService,
    PaymentResolver,
    {
      provide: 'USER_SERVICE',
      useExisting: UserService,
    },
  ],
  controllers: [PaymentController],
  exports: [PaymentService],
})
export class PaymentModule {}
