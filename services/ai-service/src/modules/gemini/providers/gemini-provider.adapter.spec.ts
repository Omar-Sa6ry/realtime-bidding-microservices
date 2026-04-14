import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GeminiProviderAdapter } from './gemini-provider.adapter';
import { ChatRole } from '../../../common/constants/role.enum';

jest.mock('@google/generative-ai');

describe('GeminiProviderAdapter', () => {
  let adapter: GeminiProviderAdapter;
  let configService: ConfigService;

  const mockApiKey = 'test-api-key';
  const mockModelName = 'gemini-1.5-flash';

  // Helper to create a mock stream
  const createMockStream = (texts: string[]) => ({
    stream: (async function* () {
      for (const text of texts) {
        yield { text: () => text };
      }
    })(),
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeminiProviderAdapter,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'GEMINI_API_KEY') return mockApiKey;
              if (key === 'GEMINI_MODEL') return mockModelName;
              return null;
            }),
          },
        },
      ],
    }).compile();

    adapter = module.get<GeminiProviderAdapter>(GeminiProviderAdapter);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(adapter).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should initialize GoogleGenerativeAI and models list', () => {
      adapter.onModuleInit();

      expect(configService.get).toHaveBeenCalledWith('GEMINI_API_KEY');
      expect(GoogleGenerativeAI).toHaveBeenCalledWith(mockApiKey);
    });

    it('should throw error if GEMINI_API_KEY is missing', () => {
      jest.spyOn(configService, 'get').mockReturnValue(null);

      expect(() => adapter.onModuleInit()).toThrow('GEMINI_API_KEY is not defined.');
    });

    it('should use default model if GEMINI_MODEL is missing', () => {
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'GEMINI_API_KEY') return mockApiKey;
        return null;
      });

      adapter.onModuleInit();
      // Should default to 'gemini-1.5-flash'
    });
  });

  describe('sendMessageStream', () => {
    const text = 'Hello';
    const history = [{ role: ChatRole.USER, content: 'Hi' }];
    const systemInstruction = 'You are a helpful assistant';

    const mockModel = {
      startChat: jest.fn(),
    };
    const mockChat = {
      sendMessageStream: jest.fn(),
    };

    beforeEach(() => {
      adapter.onModuleInit();
      (GoogleGenerativeAI.prototype.getGenerativeModel as jest.Mock).mockReturnValue(mockModel);
      mockModel.startChat.mockReturnValue(mockChat);
    });

    it('should stream response successfully from the first model', async () => {
      const mockResponse = createMockStream(['Hello', '!', ' How can I help?']);
      mockChat.sendMessageStream.mockResolvedValue(mockResponse);

      const stream = adapter.sendMessageStream(text, history, systemInstruction);
      const results = [];
      for await (const chunk of stream) {
        results.push(chunk);
      }

      expect(results).toEqual(['Hello', '!', ' How can I help?']);
      expect(mockModel.startChat).toHaveBeenCalledWith(expect.objectContaining({
        history: [{ role: 'user', parts: [{ text: 'Hi' }] }],
        systemInstruction: { role: 'user', parts: [{ text: systemInstruction }] },
      }));
      expect(mockChat.sendMessageStream).toHaveBeenCalledWith(text);
    });

    it('should fallback to second model if first one fails with non-fatal error', async () => {
      // First model fail
      mockChat.sendMessageStream
        .mockRejectedValueOnce(new Error('Quota exceeded')) // Non-fatal
        .mockResolvedValueOnce(createMockStream(['Fallback success'])); // Second model success

      const stream = adapter.sendMessageStream(text, history, systemInstruction);
      const results = [];
      for await (const chunk of stream) {
        results.push(chunk);
      }

      expect(results).toEqual(['Fallback success']);
      expect(mockChat.sendMessageStream).toHaveBeenCalledTimes(2);
    });

    it('should throw immediately if a fatal error occurs (e.g. 401)', async () => {
      const fatalError = new Error('401 Unauthorized');
      mockChat.sendMessageStream.mockRejectedValue(fatalError);

      const stream = adapter.sendMessageStream(text, history, systemInstruction);
      
      await expect(async () => {
        for await (const _ of stream) {}
      }).rejects.toThrow('401 Unauthorized');

      // Should not try second model
      expect(mockChat.sendMessageStream).toHaveBeenCalledTimes(1);
    });

    it('should throw the last error if all models are exhausted', async () => {
      const lastError = new Error('Model exhausted');
      mockChat.sendMessageStream.mockRejectedValue(lastError);

      const stream = adapter.sendMessageStream(text, history, systemInstruction);
      
      await expect(async () => {
        for await (const _ of stream) {}
      }).rejects.toThrow('Model exhausted');

      // It tries all models (gemini-1.5-flash, gemini-2.0-flash, gemini-1.5-pro)
      expect(mockChat.sendMessageStream).toHaveBeenCalledTimes(3);
    });
  });
});
