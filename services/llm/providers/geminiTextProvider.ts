import { SYSTEM_PROMPT } from '../../../constants';
import { sendMessageStreamToBackendGemini } from '../../localSpeechService';
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
  yield* sendMessageStreamToBackendGemini(message, chatHistory, studyMaterial, {
    systemInstruction: systemInstructionOverride ?? SYSTEM_PROMPT,
    temperature: temperatureOverride,
    maxOutputTokens: maxOutputTokensOverride,
    responseMimeType: responseMimeTypeOverride,
  });
}

export const geminiTextProvider: LlmTextProvider = {
  id: 'gemini',
  label: 'Google Gemini',
  streamChat,
};
