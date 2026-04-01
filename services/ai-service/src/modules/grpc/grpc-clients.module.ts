import { RedisModule } from '@bts-soft/core';
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { ContextService } from './context.service';

@Module({
  imports: [
    RedisModule,
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
      {
        name: 'GRPC_BIDDING_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'bidding',
          protoPath: join(process.cwd(), '../../proto/bidding.proto'),
          url: process.env.BIDDING_GRPC_URL || 'bidding-srv:50053',
        },
      },
    ]),
  ],
  providers: [ContextService],
  exports: [ClientsModule, ContextService],
})
export class GrpcClientsModule {}
