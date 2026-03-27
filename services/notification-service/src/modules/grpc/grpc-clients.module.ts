import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';

@Module({
  imports: [
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
      {
        name: 'GRPC_AUCTION_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'auction',
          protoPath: join(process.cwd(), '../../proto/auction.proto'),
          url: process.env.AUCTION_GRPC_URL || 'auction-srv:50052',
        },
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class GrpcClientsModule {}
