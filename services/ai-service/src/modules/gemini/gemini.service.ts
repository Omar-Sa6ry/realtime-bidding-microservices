import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ChatMessage } from '../ai/schemas/chat-message.schema';
import { ChatThread } from '../ai/schemas/chat-thread.schema';
import { ChatMessage as IChatMessage } from './interfaces/ai-provider.interface';
import { ContextService } from '../grpc/context.service';
import { ClientProxy } from '@nestjs/microservices';
import { NATS_SERVICE } from '../nats/nats.module';
import { SendMessageInput } from './inputs/sendMessage.input';
import { ChatRole } from '../../common/constants/role.enum';
import { I18nService } from 'nestjs-i18n';
import {
  GetChatMessagesResponse,
  GetChatThreadsResponse,
  SendMessageResponse,
} from './dtos/aiService.dto';
import { PaginationInputA } from './inputs/pagination.input';
import { GeminiProviderAdapter } from './providers/gemini-provider.adapter';
import { PromptFactory } from './factories/prompt-factory.service';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);

  constructor(
    private readonly contextService: ContextService,
    private readonly i18n: I18nService,
    @Inject(NATS_SERVICE) private readonly natsClient: ClientProxy,
    private readonly aiProvider: GeminiProviderAdapter,
    private readonly promptFactory: PromptFactory,

    @InjectModel(ChatMessage.name)
    private readonly messageModel: Model<ChatMessage>,

    @InjectModel(ChatThread.name)
    private readonly threadModel: Model<ChatThread>,
  ) {}

  async sendMessage(
    userId: string,
    sendMessageInput: SendMessageInput,
  ): Promise<SendMessageResponse> {
    const { auctionId, text, language = 'en' } = sendMessageInput;

    let thread = await this.threadModel.findOne({ auctionId, userId });
    if (!thread) {
      thread = await this.threadModel.create({ auctionId, userId });
    }

    if (!text || text.trim().length === 0) {
      return {
        data: { threadId: thread._id.toString(), isFinal: true, userId },
        message: 'Message cannot be empty',
        statusCode: 400,
        success: false,
        timeStamp: new Date().toISOString(),
      };
    }

    await this.messageModel.create({
      threadId: thread._id,
      role: ChatRole.USER,
      content: text,
    });

    const threadId = thread._id.toString();

    try {
      const context = await this.contextService.getAiContext(auctionId, userId);
      const history = await this.messageModel
        .find({ threadId: thread._id })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

      const strategy = this.promptFactory.getStrategy('auction');
      const systemInstruction = strategy.build(context, language);

      const aiHistory: IChatMessage[] = history.reverse().map((msg) => ({
        role: msg.role === ChatRole.USER ? ChatRole.USER : ChatRole.MODEL,
        content: msg.content,
      }));

      // Gemini requires the conversation to start with a 'user' message
      while (aiHistory.length > 0 && aiHistory[0].role !== ChatRole.USER) {
        aiHistory.shift();
      }

      let fullResponse = '';
      const stream = this.aiProvider.sendMessageStream(
        text,
        aiHistory,
        systemInstruction,
      );
      
      for await (const chunk of stream) {
        fullResponse += chunk;
        await this.emitChunk({
          userId,
          threadId,
          chunk,
          isFinal: false,
        });
      }

      await this.messageModel.create({
        threadId: thread._id,
        role: ChatRole.MODEL,
        content: fullResponse,
      });
    } catch (error) {
      this.logger.warn(`AI Error: ${error.message}`);
      const errorMessage =
        'As an AI assistant, I am currently experiencing high load. Please try again in a few moments.';

      await this.emitChunk({
        userId,
        threadId,
        chunk: errorMessage,
        isFinal: false,
      });

      await this.messageModel.create({
        threadId: thread._id,
        role: ChatRole.MODEL,
        content: errorMessage,
      });
    }

    // Send the final "done" chunk
    await this.emitChunk({
      userId,
      threadId,
      chunk: '',
      isFinal: true,
    });

    return {
      data: { threadId, isFinal: true, userId },
      message: await this.i18n.t('ai.MESSAGE_SENT_SUCCESSFULLY'),
      statusCode: 200,
      success: true,
      timeStamp: new Date().toISOString(),
    };
  }

  async getUserChatThreads(
    userId: string,
    pagination?: PaginationInputA,
  ): Promise<GetChatThreadsResponse> {
    const { page = 1, limit = 10 } = pagination || {};
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.threadModel
        .find({ userId })
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.threadModel.countDocuments({ userId }),
    ]);

    return {
      items: items as any,
      pagination: {
        totalItems: total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
      },
      message: await this.i18n.t('ai.CHAT_MESSAGES_RETRIEVED_SUCCESSFULLY'),
      statusCode: 200,
      success: true,
      timeStamp: new Date().toISOString(),
    };
  }

  async getChatMessages(
    threadId: string,
    userId: string,
    pagination?: PaginationInputA,
  ): Promise<GetChatMessagesResponse> {
    const thread = await this.threadModel.findOne({ _id: threadId, userId });
    if (!thread)
      throw new NotFoundException(await this.i18n.t('ai.THREAD_NOT_FOUND'));

    const { page = 1, limit = 20 } = pagination || {};
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.messageModel
        .find({ threadId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.messageModel.countDocuments({ threadId }),
    ]);

    return {
      items: items.reverse() as any,
      pagination: {
        totalItems: total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
      },
      message: await this.i18n.t('ai.CHAT_MESSAGES_RETRIEVED_SUCCESSFULLY'),
      statusCode: 200,
      success: true,
      timeStamp: new Date().toISOString(),
    };
  }

  private async emitChunk(data: {
    userId: string;
    threadId: string;
    chunk: string;
    isFinal: boolean;
  }): Promise<void> {
    try {
      await lastValueFrom(this.natsClient.emit('ai.message.chunk', data));
    } catch (err) {
      this.logger.error(`Failed to emit NATS chunk: ${err.message}`);
    }
  }
}

