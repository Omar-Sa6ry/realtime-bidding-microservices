import { ChatRole } from "src/common/constants/role.enum";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface AIProviderResponse {
  text: string;
  stream?: AsyncIterable<any>;
}

export interface IAIProvider {
  sendMessageStream(
    text: string,
    history: ChatMessage[],
    systemInstruction: string,
  ): AsyncIterable<string>;
}
