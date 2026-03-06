import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';
import { UserModule } from '../users/users.module';
import { User } from '../users/entity/user.entity';
import { NotificationModule, RedisModule } from '@bts-soft/core';
import { JwtModule } from './jwt/jwt.module';
import { GenerateTokenFactory } from './jwt/jwt.service';
import { AuthServiceFacade } from './fascade/AuthService.facade';
import { PasswordServiceAdapter } from './adapter/password.adapter';
import { UserProxy } from '../users/proxy/user.proxy';
import {UploadModule} from "@bts-soft/upload"

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    UserModule,
    RedisModule,
    UploadModule,
    NotificationModule,
    JwtModule,
  ],
  providers: [
    AuthResolver,
    AuthService,
    UserProxy,
    AuthServiceFacade,
    PasswordServiceAdapter,
    GenerateTokenFactory,
  ],
})
export class AuthModule {}
