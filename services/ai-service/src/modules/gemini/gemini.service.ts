import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ChatMessage } from '../ai/schemas/chat-message.schema';
import { ChatThread } from '../ai/schemas/chat-thread.schema';
import { ContextService } from '../grpc/context.service';
import { ClientProxy } from '@nestjs/microservices';
import { NATS_SERVICE } from '../nats/nats.module';
import { SendMessageInput } from './inputs/sendMessage.input';
import { ChatRole } from '../../common/constants/role.enum';
import { I18nService } from 'nestjs-i18n';
import { SendMessageResponse } from './dtos/sendMessage.dto';

@Injectable()
export class GeminiService implements OnModuleInit {
  private readonly logger = new Logger(GeminiService.name);
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor(
    private readonly configService: ConfigService,
    private readonly contextService: ContextService,
    private readonly i18n: I18nService,
    @Inject(NATS_SERVICE) private readonly natsClient: ClientProxy,

    @InjectModel(ChatMessage.name)
    private readonly messageModel: Model<ChatMessage>,

    @InjectModel(ChatThread.name)
    private readonly threadModel: Model<ChatThread>,
  ) {}

  onModuleInit() {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey)
      throw new Error(
        'GEMINI_API_KEY is not defined in the process environment.',
      );

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
    });
  }

  async sendMessage(
    sendMessageInput: SendMessageInput,
  ): Promise<SendMessageResponse> {
    const { auctionId, userId, text } = sendMessageInput;

    let thread = await this.threadModel.findOne({ auctionId, userId });
    if (!thread) thread = await this.threadModel.create({ auctionId, userId });

    await this.messageModel.create({
      threadId: thread._id,
      role: ChatRole.USER,
      content: text,
    });

    const context = await this.contextService.getAiContext(auctionId, userId);

    const history = await this.messageModel
      .find({ threadId: thread._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const systemPrompt = this.buildSystemPrompt(context);
    const geminiHistory = history.reverse().map((msg) => ({
      role: msg.role === ChatRole.USER ? ChatRole.USER : ChatRole.MODEL,
      parts: [{ text: msg.content }],
    }));

    const chat = this.model.startChat({
      history: geminiHistory,
      systemInstruction: systemPrompt,
    });

    const result = await chat.sendMessageStream(text);
    let fullResponse = '';

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullResponse += chunkText;

      this.natsClient.emit('ai.message.chunk', {
        userId,
        threadId: thread._id,
        chunk: chunkText,
        isFinal: false,
      });
    }

    await this.messageModel.create({
      threadId: thread._id,
      role: ChatRole.MODEL,
      content: fullResponse,
    });

    this.natsClient.emit('ai.message.chunk', {
      userId,
      threadId: thread._id,
      chunk: '',
      isFinal: true,
    });

    return {
      data: { threadId: thread._id.toString(), isFinal: true, userId },
      message: await this.i18n.t('ai.MESSAGE_SENT_SUCCESSFULLY'),
      statusCode: 200,
    };
  }

  private buildSystemPrompt(context: any): string {
    const { auction, userBids, user } = context;

    let prompt = `You are a helpful bidding assistant. 
    Current user: ${user ? `${user.firstname} ${user.lastname}` : 'Unknown'}.
    User Balance: ${user?.balance || 0} EGP.
    
    Auction Context:
    - Item: ${auction?.title || 'Unknown Item'}
    - Description: ${auction?.description || 'N/A'}
    - Current Price: ${auction?.current_price || 0} EGP
    - End Time: ${auction?.end_time || 'Unknown'}
    - Status: ${auction?.status || 'Unknown'}
    
    User Bidding History in this auction:
    ${
      userBids.length > 0
        ? userBids.map((b) => `- ${b.amount} USD at ${b.created_at}`).join('\n')
        : 'User has no bids yet in this auction.'
    }
    
    Instructions:
    1. Be concise and professional.
    2. Help users understand the product and their bidding status.
    3. If they ask to bid, remind them to use the bid button/form.
    4. Use the provided context to answer accurately.
    `;

    return prompt;
  }
}
