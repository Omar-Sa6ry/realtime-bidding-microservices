import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { IAIProvider, ChatMessage } from '../interfaces/ai-provider.interface';
import { ChatRole } from 'src/common/constants/role.enum';

@Injectable()
export class GeminiProviderAdapter implements IAIProvider, OnModuleInit {
  private readonly logger = new Logger(GeminiProviderAdapter.name);
  private genAI: GoogleGenerativeAI;

  private models: string[];

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEY is not defined.');

    this.genAI = new GoogleGenerativeAI(apiKey);

    const primary =
      this.configService.get<string>('GEMINI_MODEL') || 'gemini-1.5-flash';

    this.models = [primary, 'gemini-2.0-flash', 'gemini-1.5-pro'].filter(
      (v, i, a) => a.indexOf(v) === i,
    );

    this.logger.log(`Gemini models (in priority): ${this.models.join(', ')}`);
  }

  private isFatalError(error: any): boolean {
    const msg = error?.message || '';
    return (
      msg.includes('401') ||
      msg.includes('403') ||
      msg.includes('API_KEY_INVALID') ||
      msg.includes('PERMISSION_DENIED')
    );
  }

  async *sendMessageStream(
    text: string,
    history: ChatMessage[],
    systemInstruction: string,
  ): AsyncIterable<string> {
    const geminiHistory = history.map((msg) => ({
      role: msg.role === ChatRole.USER ? ChatRole.USER : ChatRole.MODEL,
      parts: [{ text: msg.content }],
    }));

    let lastError: any;

    for (const modelName of this.models) {
      try {
        this.logger.log(`Trying model: ${modelName}`);
        const model = this.genAI.getGenerativeModel(
          { model: modelName },
          { apiVersion: 'v1' },
        );

        const chat = model.startChat({
          history: geminiHistory,
          systemInstruction: {
            role: 'user',
            parts: [{ text: systemInstruction }],
          },
        });

        const result = await chat.sendMessageStream(text);
        for await (const chunk of result.stream) {
          yield chunk.text();
        }
        return;
      } catch (error) {
        lastError = error;

        if (this.isFatalError(error)) {
          throw error;
        }

        this.logger.warn(
          `Model "${modelName}" failed: ${error.message?.substring(0, 120)} — trying next model...`,
        );
        continue;
      }
    }

    this.logger.error(
      'All Gemini models exhausted. No model could process the request.',
    );
    throw lastError;
  }
}
