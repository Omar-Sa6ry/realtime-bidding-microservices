import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { GeminiService } from './gemini.service';
import { ChatMessage } from '../ai/schemas/chat-message.schema';
import { ChatThread } from '../ai/schemas/chat-thread.schema';
import { ContextService } from '../grpc/context.service';
import { I18nService } from 'nestjs-i18n';
import { GeminiProviderAdapter } from './providers/gemini-provider.adapter';
import { PromptFactory } from './factories/prompt-factory.service';
import { NATS_SERVICE } from '../nats/nats.module';
import { of, throwError } from 'rxjs';
import { ChatRole } from '../../common/constants/role.enum';
import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';

jest.mock('../ai/schemas/chat-message.schema', () => ({
  ChatMessage: { name: 'ChatMessage' },
  ChatMessageSchema: {},
}));

jest.mock('../ai/schemas/chat-thread.schema', () => ({
  ChatThread: { name: 'ChatThread' },
  ChatThreadSchema: {},
}));

describe('GeminiService', () => {
  let service: GeminiService;
  let mockContextService: any;
  let mockI18n: any;
  let mockNatsClient: any;
  let mockAiProvider: any;
  let mockPromptFactory: any;
  let mockMessageModel: any;
  let mockThreadModel: any;

  const userId = 'user-1';
  const auctionId = 'auction-1';
  const threadId = new Types.ObjectId().toString();

  const createMockQuery = (data: any) => ({
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(data),
  });

  const mockStream = async function* (chunks: string[]) {
    for (const chunk of chunks) {
      yield chunk;
    }
  };

  beforeEach(async () => {
    mockContextService = {
      getAiContext: jest.fn(),
    };
    mockI18n = {
      t: jest.fn().mockResolvedValue('translated-text'),
      translate: jest.fn().mockResolvedValue('translated-error'),
    };
    mockNatsClient = {
      emit: jest.fn().mockReturnValue(of({})),
    };
    mockAiProvider = {
      sendMessageStream: jest.fn(),
    };
    mockPromptFactory = {
      getStrategy: jest.fn().mockReturnValue({
        build: jest.fn().mockReturnValue('system-instruction'),
      }),
    };
    mockMessageModel = {
      create: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn(),
    };
    mockThreadModel = {
      findOne: jest.fn(),
      create: jest.fn(),
      countDocuments: jest.fn(),
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeminiService,
        { provide: ContextService, useValue: mockContextService },
        { provide: I18nService, useValue: mockI18n },
        { provide: NATS_SERVICE, useValue: mockNatsClient },
        { provide: GeminiProviderAdapter, useValue: mockAiProvider },
        { provide: PromptFactory, useValue: mockPromptFactory },
        { provide: getModelToken(ChatMessage.name), useValue: mockMessageModel },
        { provide: getModelToken(ChatThread.name), useValue: mockThreadModel },
      ],
    }).compile();

    service = module.get<GeminiService>(GeminiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendMessage', () => {
    const sendMessageInput = { auctionId, text: 'Hello', language: 'en' };
    const mockThread = { _id: new Types.ObjectId(threadId), auctionId, userId };

    it('should return error if text is empty', async () => {
      mockThreadModel.findOne.mockResolvedValue(mockThread);
      const result = await service.sendMessage(userId, { ...sendMessageInput, text: '' });
      expect(result.success).toBe(false);
      expect(result.message).toBe('Message cannot be empty');
    });

    it('should create a new thread if one does not exist', async () => {
      mockThreadModel.findOne.mockResolvedValue(null);
      mockThreadModel.create.mockResolvedValue(mockThread);
      mockAiProvider.sendMessageStream.mockReturnValue(mockStream(['Hi']));

      await service.sendMessage(userId, sendMessageInput);
      expect(mockThreadModel.create).toHaveBeenCalledWith({ auctionId, userId });
    });

    it('should process message and stream response correctly', async () => {
      mockThreadModel.findOne.mockResolvedValue(mockThread);
      mockContextService.getAiContext.mockResolvedValue({ some: 'context' });
      
      const mockHistory = [
        { role: ChatRole.USER, content: 'user-msg' },
        { role: ChatRole.MODEL, content: 'ai-msg' }
      ];
      mockMessageModel.find.mockReturnValue(createMockQuery(mockHistory));
      
      mockAiProvider.sendMessageStream.mockReturnValue(mockStream(['Hello', ' world']));

      const result = await service.sendMessage(userId, sendMessageInput);

      expect(result.success).toBe(true);
      expect(mockMessageModel.create).toHaveBeenCalledWith({
        threadId: mockThread._id,
        role: ChatRole.USER,
        content: 'Hello',
      });
      expect(mockAiProvider.sendMessageStream).toHaveBeenCalled();
      // Should emit chunks via NATS
      expect(mockNatsClient.emit).toHaveBeenCalledWith('ai.message.chunk', expect.objectContaining({ chunk: 'Hello', isFinal: false }));
      expect(mockNatsClient.emit).toHaveBeenCalledWith('ai.message.chunk', expect.objectContaining({ chunk: ' world', isFinal: false }));
      expect(mockNatsClient.emit).toHaveBeenCalledWith('ai.message.chunk', expect.objectContaining({ isFinal: true }));
      
      // Should save model response
      expect(mockMessageModel.create).toHaveBeenCalledWith({
        threadId: mockThread._id,
        role: ChatRole.MODEL,
        content: 'Hello world',
      });
    });

    it('should handle AI provider errors', async () => {
      mockThreadModel.findOne.mockResolvedValue(mockThread);
      mockMessageModel.find.mockReturnValue(createMockQuery([]));
      mockAiProvider.sendMessageStream.mockImplementation(() => {
        throw new Error('AI Down');
      });

      await service.sendMessage(userId, sendMessageInput);

      expect(mockI18n.translate).toHaveBeenCalledWith('ai.AI_HIGH_LOAD', expect.any(Object));
      expect(mockNatsClient.emit).toHaveBeenCalledWith('ai.message.chunk', expect.objectContaining({ chunk: 'translated-error' }));
      expect(mockMessageModel.create).toHaveBeenCalledWith(expect.objectContaining({
        content: 'translated-error',
        role: ChatRole.MODEL
      }));
    });
  });

  describe('getUserChatThreads', () => {
    it('should return paginated threads', async () => {
      const mockThreads = [{ _id: '1' }, { _id: '2' }];
      mockThreadModel.find.mockReturnValue(createMockQuery(mockThreads));
      mockThreadModel.countDocuments.mockResolvedValue(2);

      const result = await service.getUserChatThreads(userId, { page: 1, limit: 10 });

      expect(result.success).toBe(true);
      expect(result.items).toHaveLength(2);
      expect(result.pagination.totalItems).toBe(2);
    });
  });

  describe('getChatMessages', () => {
    it('should return paginated and reversed messages', async () => {
      mockThreadModel.findOne.mockResolvedValue({ _id: threadId });
      const mockMessages = [{ content: 'msg2' }, { content: 'msg1' }]; // Order from DB is newest first
      mockMessageModel.find.mockReturnValue(createMockQuery(mockMessages));
      mockMessageModel.countDocuments.mockResolvedValue(2);

      const result = await service.getChatMessages(threadId, userId);

      expect(result.success).toBe(true);
      expect(result.items[0].content).toBe('msg1'); // Should be reversed to show oldest first
      expect(result.items[1].content).toBe('msg2');
    });

    it('should throw NotFoundException if thread not found', async () => {
      mockThreadModel.findOne.mockResolvedValue(null);

      await expect(service.getChatMessages(threadId, userId)).rejects.toThrow(NotFoundException);
    });
  });
});
