import { RoleGuard } from '../guard/role.guard';
import { StringValue } from 'ms';
import { DynamicModule, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NatsClientModule } from '../nats/nats.module';

@Module({})
export class AuthCommonModule {
  static register(options: {
    userService: any;
    imports?: any[];
    providers?: any[];
  }): DynamicModule {
    return {
      module: AuthCommonModule,
      imports: [
        ...(options.imports || []),
        NatsClientModule,
        JwtModule.register({
          secret: process.env.JWT_SECRET || 'default_secret',
          signOptions: { expiresIn: process.env.JWT_EXPIRE as StringValue },
        }),
      ],
      providers: [
        RoleGuard,
        ...(options.providers || []),
        options.userService,
        {
          provide: 'USER_SERVICE',
          useExisting: options.userService,
        },
      ],
      exports: ['USER_SERVICE', JwtModule, RoleGuard, options.userService],
    };
  }
}
