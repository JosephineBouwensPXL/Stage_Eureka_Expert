import { SpeakRequest, TtsPlaybackSession, TtsProvider } from '../types';

export const browserTtsProvider: TtsProvider = {
  id: 'browser',
  label: 'Browser Speech Synthesis',
  async speak({ text, language = 'nl-NL' }: SpeakRequest): Promise<TtsPlaybackSession | null> {
    const trimmed = text.trim();
    if (!trimmed) return null;

    let settled = false;
    let resolveFinished = () => {};

    const finished = new Promise<void>((resolve) => {
      resolveFinished = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
    });

    const utterance = new SpeechSynthesisUtterance(trimmed);
    utterance.lang = language;
    utterance.onend = () => resolveFinished();
    utterance.onerror = () => resolveFinished();

    window.speechSynthesis.speak(utterance);

    return {
      finished,
      stop() {
        window.speechSynthesis.cancel();
        resolveFinished();
      },
    };
  },
};
