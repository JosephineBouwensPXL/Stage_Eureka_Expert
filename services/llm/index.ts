import { ModeAccess } from '../../types';
import { geminiTextProvider } from './providers/geminiTextProvider';
import { localOllamaTextProvider } from './providers/localOllamaTextProvider';
import { LlmProviderId, LlmTextProvider, StreamChatRequest } from './types';

const textProviders: Record<LlmProviderId, LlmTextProvider> = {
  gemini: geminiTextProvider,
  'local-ollama': localOllamaTextProvider,
};

export function getDefaultTextProviderId(mode: ModeAccess): LlmProviderId {
  return mode === ModeAccess.CLASSIC ? 'local-ollama' : 'gemini';
}

export function getTextProvider(providerId: LlmProviderId): LlmTextProvider {
  return textProviders[providerId];
}

export function streamChatWithProvider(
  providerId: LlmProviderId,
  request: StreamChatRequest
): AsyncGenerator<string> {
  return getTextProvider(providerId).streamChat(request);
}
