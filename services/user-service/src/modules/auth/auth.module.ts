import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';
import { UserModule } from '../users/users.module';
import { User } from '../users/entity/user.entity';
import { Transaction } from '../users/entity/transaction.entity';
import { NotificationModule, RedisModule } from '@bts-soft/core';
import { JwtModule } from './jwt/jwt.module';
import { TokenService } from './jwt/jwt.service';
import { AuthServiceFacade } from './fascade/AuthService.facade';
import { PasswordServiceAdapter } from './adapter/password.adapter';
import { AuthGrpcController } from './auth.controller';
import { AuthCommonModule } from '@bidding-micro/shared';
import { UserService } from '../users/users.service';
import { TranslationModule } from '../../common/translation/translation.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Transaction]),
    UserModule,
    RedisModule,
    NotificationModule,
    JwtModule,

    AuthCommonModule.register({
      userService: UserService,
      imports: [
        TypeOrmModule.forFeature([User, Transaction]),
        RedisModule,
        TranslationModule,
      ],
    }),
  ],

  providers: [
    AuthResolver,
    AuthService,
    AuthServiceFacade,
    PasswordServiceAdapter,
    TokenService,
    {
      provide: 'USER_SERVICE',
      useExisting: UserService,
    },
  ],

  controllers: [AuthGrpcController],
})
export class AuthModule {}
