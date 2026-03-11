import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './users.service';
import { UserResolver } from './users.resolver';
import { User } from './entity/user.entity';
import { RedisModule } from '@bts-soft/core';
import { UserNatsController } from './user.controller';
import { TranslationModule } from '../../common/translation/translation.module';
import { AuthCommonModule } from '@bidding-micro/shared';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    RedisModule,
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
    UserService,
    UserResolver,
    {
      provide: 'USER_SERVICE',
      useExisting: UserService,
    },
  ],

  controllers: [UserNatsController],
  exports: [UserService, TypeOrmModule],
})
export class UserModule {}
