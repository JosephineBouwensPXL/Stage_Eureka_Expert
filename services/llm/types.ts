export type ChatHistoryItem = {
  role: string;
  parts: string;
};

export type LlmProviderId = "gemini" | "local-ollama";

export type StreamChatRequest = {
  message: string;
  chatHistory: ChatHistoryItem[];
  studyMaterial?: string;
};

export interface LlmTextProvider {
  id: LlmProviderId;
  label: string;
  streamChat(request: StreamChatRequest): AsyncGenerator<string>;
}
