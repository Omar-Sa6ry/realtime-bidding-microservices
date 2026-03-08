import { Module } from '@nestjs/common';
import { UserResolver } from './user.resolver';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'USER_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'user',
          protoPath: join(process.cwd(), '../../proto/user.proto'),
          url: process.env.USER_SERVICE_URL || 'user-srv:50051',
        },
      },
    ]),
  ],
  providers: [UserResolver],
})
export class UserModule {}
