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
    maxDurationMs = 9000,
    onInterimTranscript,
  }: CaptureSpeechRequest): Promise<SttCaptureSession> {
    const speechWindow = window as SpeechRecognitionWindow;
    const SpeechRecognitionCtor =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      throw new Error('Browser STT is niet beschikbaar in deze browser.');
    }

    console.info('[Browser STT] Provider initialized', {
      language,
      maxDurationMs,
      hasSpeechRecognition: Boolean(SpeechRecognitionCtor),
    });

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = language;
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    let settled = false;
    let acceptedTranscript: string | null = null;
    let latestTranscript: string | null = null;
    let resolveResult = (_value: string | null) => {};
    let stopTimer: number | null = null;
    let requestedStop = false;
    let timedOut = false;
    let isRecognitionActive = false;

    const safeStart = () => {
      if (settled || requestedStop) return;
      try {
        recognition.start();
        isRecognitionActive = true;
        console.info('[Browser STT] recognition.start() called');
      } catch {
        // Ignore duplicate/temporary start errors from the browser API.
        console.warn('[Browser STT] recognition.start() failed');
      }
    };

    const finalize = (value: string | null) => {
      if (settled) return;
      settled = true;
      if (stopTimer !== null) {
        window.clearTimeout(stopTimer);
        stopTimer = null;
      }
      resolveResult(value);
    };

    const result = new Promise<string | null>((resolve) => {
      resolveResult = resolve;
    });

    recognition.onresult = (event: any) => {
      const results = Array.from(event.results ?? []);
      const transcript = results
        .map((item: any) => item?.[0]?.transcript ?? '')
        .join(' ')
        .trim();

      if (!transcript) return;
      console.info('[Browser STT] onresult', {
        transcriptLength: transcript.length,
        resultCount: results.length,
      });
      latestTranscript = transcript;
      onInterimTranscript?.(transcript);

      const latestResult = results[results.length - 1];
      if (!latestResult?.isFinal) return;
      if (isLikelyBadTranscript?.(transcript)) return;
      acceptedTranscript = transcript;
    };

    recognition.onerror = (event: any) => {
      const errorCode = event?.error ?? 'unknown';
      console.warn('[Browser STT] onerror', {
        error: errorCode,
        requestedStop,
        timedOut,
        latestTranscriptLength: latestTranscript?.length ?? 0,
      });
      if (errorCode === 'not-allowed' || errorCode === 'service-not-allowed') {
        requestedStop = true;
        finalize(null);
        return;
      }
      if (errorCode === 'audio-capture') {
        requestedStop = true;
        finalize(null);
        return;
      }
      if (requestedStop || timedOut) {
        finalize(acceptedTranscript ?? latestTranscript);
        return;
      }
      isRecognitionActive = false;
    };

    recognition.onend = () => {
      console.info('[Browser STT] onend', {
        requestedStop,
        timedOut,
        latestTranscriptLength: latestTranscript?.length ?? 0,
      });
      isRecognitionActive = false;
      if (requestedStop || timedOut) {
        finalize(acceptedTranscript ?? latestTranscript);
        return;
      }
      window.setTimeout(() => {
        safeStart();
      }, 120);
    };

    safeStart();
    stopTimer = window.setTimeout(() => {
      timedOut = true;
      try {
        recognition.stop();
      } catch {
        finalize(acceptedTranscript ?? latestTranscript);
      }
    }, maxDurationMs);

    return {
      result,
      stop() {
        requestedStop = true;
        try {
          if (isRecognitionActive) {
            recognition.stop();
          } else {
            finalize(acceptedTranscript ?? latestTranscript);
          }
        } catch {
          finalize(acceptedTranscript ?? latestTranscript);
        }
      },
    };
  },
};
