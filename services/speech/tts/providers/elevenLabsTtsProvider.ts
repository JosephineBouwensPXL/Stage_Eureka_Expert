import { synthesizeSpeechWithElevenLabs } from '../../../elevenLabsTts';
import { SpeakRequest, TtsPlaybackSession, TtsProvider } from '../types';
import { sanitizeSpeechText } from '../sanitizeSpeechText';

export const elevenLabsTtsProvider: TtsProvider = {
  id: 'elevenlabs',
  label: 'ElevenLabs',
  async speak({ text, language = 'nl' }: SpeakRequest): Promise<TtsPlaybackSession | null> {
    const speechText = sanitizeSpeechText(text);
    if (!speechText) return null;
    const audioUrl = await synthesizeSpeechWithElevenLabs(speechText, language);
    if (!audioUrl) return null;
    return createAudioPlaybackSession(audioUrl);
  },
};

function createAudioPlaybackSession(audioUrl: string): TtsPlaybackSession {
  const audio = new Audio(audioUrl);

  let settled = false;
  let resolveFinished = () => {};
  const finalize = () => {
    if (settled) return;
    settled = true;
    URL.revokeObjectURL(audioUrl);
    resolveFinished();
  };

  const finished = new Promise<void>((resolve) => {
    resolveFinished = resolve;
  });

  audio.onended = finalize;
  audio.onerror = finalize;
  void audio.play().catch(finalize);

  return {
    finished,
    stop() {
      audio.pause();
      finalize();
    },
  };
}
