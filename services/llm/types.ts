export type ChatHistoryItem = {
  role: string;
  parts: string;
};

export type LlmProviderId = "gemini" | "local-ollama";

export type StreamChatRequest = {
  message: string;
  chatHistory: ChatHistoryItem[];
  studyMaterial?: string;
  fileSearchStoreName?: string;
  systemInstructionOverride?: string;
  temperatureOverride?: number;
  maxOutputTokensOverride?: number;
  responseMimeTypeOverride?: "text/plain" | "application/json";
};

export interface LlmTextProvider {
  id: LlmProviderId;
  label: string;
  streamChat(request: StreamChatRequest): AsyncGenerator<string>;
}
