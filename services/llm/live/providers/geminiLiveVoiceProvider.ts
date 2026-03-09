import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { LiveVoiceCallbacks, LiveVoiceConnectOptions, LiveVoiceProvider, LiveVoiceSession } from "../types";

const MODEL_ID = "gemini-2.5-flash-native-audio-preview-12-2025";
const VOICE_NAME = "Puck";

export const geminiLiveVoiceProvider: LiveVoiceProvider = {
  id: "gemini-live",
  label: "Gemini Live",
  async connect(options, callbacks) {
    console.info("[Native Voice] Starting live session", {
      provider: "gemini-live",
      model: MODEL_ID,
      ttsEnabled: options.ttsEnabled,
      responseModalities: options.ttsEnabled ? ["AUDIO"] : ["TEXT"],
      hasFileSearchStore: !!options.fileSearchStoreName,
      fileSearchStoreName: options.fileSearchStoreName,
    });

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const session = await ai.live.connect({
      model: MODEL_ID,
      callbacks: {
        onopen: callbacks.onOpen,
        onmessage: (message: LiveServerMessage) => {
          if (message.serverContent?.outputTranscription) {
            callbacks.onOutputTranscription(message.serverContent.outputTranscription.text);
          } else if (message.serverContent?.inputTranscription) {
            callbacks.onInputTranscription(message.serverContent.inputTranscription.text);
          }

          if (message.serverContent?.turnComplete) {
            callbacks.onTurnComplete();
          }

          const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          if (base64Audio && options.ttsEnabled) {
            callbacks.onAudioChunk(base64Audio);
          }

          if (message.serverContent?.interrupted) {
            callbacks.onInterrupted();
          }
        },
        onerror: callbacks.onError,
        onclose: callbacks.onClose,
      },
      config: {
        responseModalities: options.ttsEnabled ? [Modality.AUDIO] : [Modality.TEXT],
        ...(options.ttsEnabled
          ? { speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE_NAME } } } }
          : {}),
        ...(options.fileSearchStoreName
          ? {
              tools: [
                {
                  fileSearch: {
                    fileSearchStoreNames: [options.fileSearchStoreName],
                    topK: 8,
                  },
                },
              ],
            }
          : {}),
        systemInstruction: options.systemInstruction,
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
    });

    const liveSession: LiveVoiceSession = {
      sendAudioChunk(data, mimeType) {
        void session.sendRealtimeInput({
          media: {
            data: encodeBase64(data),
            mimeType,
          },
        });
      },
      close() {
        session.close();
      },
    };

    return liveSession;
  },
};

function encodeBase64(bytes: Uint8Array) {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
