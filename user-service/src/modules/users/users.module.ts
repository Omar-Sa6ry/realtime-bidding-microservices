import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './users.service';
import { UserResolver } from './users.resolver';
import { UserFacadeService } from './fascade/user.fascade';
import { User } from './entity/user.entity';
import { UserProxy } from './proxy/user.proxy';
import { RedisModule } from '@bts-soft/core';
import { UploadModule } from '@bts-soft/upload';

@Module({
  imports: [TypeOrmModule.forFeature([User]), RedisModule, UploadModule],
  providers: [UserService, UserResolver, UserProxy, UserFacadeService],
  exports: [UserService, UserFacadeService, UserProxy, TypeOrmModule],
})
export class UserModule {}
