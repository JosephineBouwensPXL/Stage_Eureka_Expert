import { CaptureSpeechRequest, SttCaptureSession, SttProvider } from '../types';

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: new () => any;
  webkitSpeechRecognition?: new () => any;
};

export const browserSttProvider: SttProvider = {
  id: 'browser',
  label: 'Browser Speech Recognition',
  async captureOnce({
    language = 'nl-NL',
    isLikelyBadTranscript,
  }: CaptureSpeechRequest): Promise<SttCaptureSession> {
    const speechWindow = window as SpeechRecognitionWindow;
    const SpeechRecognitionCtor =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      throw new Error('Browser STT is niet beschikbaar in deze browser.');
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = language;
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    let settled = false;
    let acceptedTranscript: string | null = null;
    let resolveResult = (_value: string | null) => {};
    const finalize = (value: string | null) => {
      if (settled) return;
      settled = true;
      resolveResult(value);
    };

    const result = new Promise<string | null>((resolve) => {
      resolveResult = resolve;
    });

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results ?? [])
        .map((item: any) => item?.[0]?.transcript ?? '')
        .join(' ')
        .trim();

      if (!transcript) return;
      if (isLikelyBadTranscript?.(transcript)) return;
      acceptedTranscript = transcript;
    };

    recognition.onerror = () => {
      finalize(null);
    };

    recognition.onend = () => {
      finalize(acceptedTranscript);
    };

    recognition.start();

    return {
      result,
      stop() {
        try {
          recognition.stop();
        } catch {
          finalize(acceptedTranscript);
        }
      },
    };
  },
};
