import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { IAIProvider, ChatMessage } from '../interfaces/ai-provider.interface';
import { ChatRole } from "src/common/constants/role.enum";

@Injectable()
export class GeminiProviderAdapter implements IAIProvider, OnModuleInit {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEY is not defined.');

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
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

    const chat = this.model.startChat({
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
  }
}
