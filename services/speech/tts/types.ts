export type TtsProviderId = "browser" | "local-sidecar" | "elevenlabs";

export type SpeakRequest = {
  text: string;
  language?: string;
};

export interface TtsPlaybackSession {
  finished: Promise<void>;
  stop(): void;
}

export interface TtsProvider {
  id: TtsProviderId;
  label: string;
  speak(request: SpeakRequest): Promise<TtsPlaybackSession | null>;
}
