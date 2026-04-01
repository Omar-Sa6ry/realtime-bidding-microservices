import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GeminiService } from '../gemini/gemini.service';
import { ChatThread, ChatThreadSchema } from './schemas/chat-thread.schema';
import { GrpcClientsModule } from '../grpc/grpc-clients.module';
import { NatsModule } from '../nats/nats.module';
import { GeminiResolver } from '../gemini/gemeni.resolver';
import { ChatMessage, ChatMessageSchema } from './schemas/chat-message.schema';
import { RedisModule, TranslationModule } from '@bts-soft/core';
import { AuthCommonModule } from '@bidding-micro/shared';
import { UserService } from '../user/user.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChatMessage.name, schema: ChatMessageSchema },
      { name: ChatThread.name, schema: ChatThreadSchema },
    ]),

    TranslationModule,
    GrpcClientsModule,

    AuthCommonModule.register({
      userService: UserService,
      providers: [UserService],
      imports: [
        MongooseModule.forFeature([
          { name: ChatMessage.name, schema: ChatMessageSchema },
          { name: ChatThread.name, schema: ChatThreadSchema },
        ]),
        RedisModule,
        TranslationModule,
        GrpcClientsModule,
      ],
    }),

    NatsModule,
  ],
  providers: [GeminiService, GeminiResolver],
  exports: [GeminiService],
})
export class AiModule {}
