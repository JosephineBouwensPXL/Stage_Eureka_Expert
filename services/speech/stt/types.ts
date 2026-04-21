export type SttProviderId = 'browser' | 'local-sidecar' | 'elevenlabs';

export type CaptureSpeechRequest = {
  language?: string;
  maxDurationMs?: number;
  isLikelyBadTranscript?: (value: string) => boolean;
  getMediaStream?: () => Promise<MediaStream>;
  onInterimTranscript?: (value: string) => void;
};

export interface SttCaptureSession {
  result: Promise<string | null>;
  stop(): void;
}

export interface SttProvider {
  id: SttProviderId;
  label: string;
  captureOnce(request: CaptureSpeechRequest): Promise<SttCaptureSession>;
}
