export type LiveVoiceProviderId = 'gemini-live';

export type LiveVoiceConnectOptions = {
  systemInstruction: string;
  ttsEnabled: boolean;
  fileSearchStoreName?: string;
};

export type LiveVoiceCallbacks = {
  onOpen: () => void;
  onClose: () => void;
  onError: (error: unknown) => void;
  onInputTranscription: (text: string) => void;
  onOutputTranscription: (text: string) => void;
  onTurnComplete: () => void;
  onAudioChunk: (base64Audio: string) => void;
  onInterrupted: () => void;
};

export interface LiveVoiceSession {
  sendAudioChunk(data: Uint8Array, mimeType: string): void;
  close(): void;
}

export interface LiveVoiceProvider {
  id: LiveVoiceProviderId;
  label: string;
  connect(
    options: LiveVoiceConnectOptions,
    callbacks: LiveVoiceCallbacks
  ): Promise<LiveVoiceSession>;
}
