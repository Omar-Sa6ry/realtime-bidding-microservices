import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './users.service';
import { UserResolver } from './users.resolver';
import { User } from './entity/user.entity';
import { RedisModule } from '@bts-soft/core';
import { UserNatsController } from './user.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User]), RedisModule],
  providers: [UserService, UserResolver],
  controllers: [UserNatsController],
  exports: [UserService, TypeOrmModule],
})
export class UserModule {}
