export type SttProviderId = "browser" | "local-sidecar";

export type CaptureSpeechRequest = {
  language?: string;
  maxDurationMs?: number;
  isLikelyBadTranscript?: (value: string) => boolean;
  getMediaStream?: () => Promise<MediaStream>;
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
