import { sendMessageStreamToLocalLLM } from '../../localSpeechService';
import { LlmTextProvider, StreamChatRequest } from '../types';

async function* streamChat({
  message,
  chatHistory,
  studyMaterial,
  systemInstructionOverride,
  temperatureOverride,
  maxOutputTokensOverride,
  responseMimeTypeOverride,
}: StreamChatRequest) {
  yield* sendMessageStreamToLocalLLM(message, chatHistory, studyMaterial, {
    systemInstruction: systemInstructionOverride,
    temperature: temperatureOverride,
    maxOutputTokens: maxOutputTokensOverride,
    responseMimeType: responseMimeTypeOverride,
  });
}

export const localOllamaTextProvider: LlmTextProvider = {
  id: 'local-ollama',
  label: 'Local Ollama',
  streamChat,
};
