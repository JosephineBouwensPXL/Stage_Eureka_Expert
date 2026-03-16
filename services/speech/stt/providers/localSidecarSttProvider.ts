import { transcribeAudioWithLocalStt } from '../../../localSpeechService';
import { CaptureSpeechRequest, SttCaptureSession, SttProvider } from '../types';

export const localSidecarSttProvider: SttProvider = {
  id: 'local-sidecar',
  label: 'Local Sidecar STT',
  async captureOnce({
    language = 'nl',
    maxDurationMs = 6500,
    isLikelyBadTranscript,
    getMediaStream,
  }: CaptureSpeechRequest): Promise<SttCaptureSession> {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      throw new Error('Audio-opname is niet beschikbaar in deze browser.');
    }

    const stream = getMediaStream
      ? await getMediaStream()
      : await navigator.mediaDevices.getUserMedia({ audio: true });

    const supportedMimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/ogg',
    ];
    const preferredMime =
      supportedMimeTypes.find((mime) => MediaRecorder.isTypeSupported(mime)) ?? '';
    const recorder = preferredMime
      ? new MediaRecorder(stream, { mimeType: preferredMime })
      : new MediaRecorder(stream);

    const audioChunks: BlobPart[] = [];
    let stopTimer: number | null = null;
    let settled = false;
    let resolveResult = (_value: string | null) => {};

    const result = new Promise<string | null>((resolve) => {
      resolveResult = resolve;
    });

    const finalize = (value: string | null) => {
      if (settled) return;
      settled = true;
      if (stopTimer !== null) {
        window.clearTimeout(stopTimer);
        stopTimer = null;
      }
      resolveResult(value);
    };

    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size > 0) audioChunks.push(event.data);
    };

    recorder.onerror = () => finalize(null);

    recorder.onstop = async () => {
      try {
        const blob = new Blob(audioChunks, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size < 256) {
          finalize(null);
          return;
        }

        const transcript = await transcribeAudioWithLocalStt(blob, language);
        if (!transcript.trim()) {
          finalize(null);
          return;
        }

        if (isLikelyBadTranscript?.(transcript)) {
          finalize(null);
          return;
        }

        finalize(transcript);
      } catch {
        finalize(null);
      }
    };

    recorder.start();
    stopTimer = window.setTimeout(() => {
      if (recorder.state !== 'inactive') recorder.stop();
    }, maxDurationMs);

    return {
      result,
      stop() {
        if (recorder.state !== 'inactive') {
          recorder.stop();
        } else {
          finalize(null);
        }
      },
    };
  },
};
