import { useCallback, useRef } from 'react';
import { ModeAccess, ClassicTtsMode } from '../types';
import { getChatTtsProviderId, getTtsProvider } from '../services/speech/tts';
import { TtsPlaybackSession } from '../services/speech/tts/types';

type UseTtsQueueParams = {
  engineMode: ModeAccess;
  classicTtsMode: ClassicTtsMode;
  isClassicTtsEnabled: boolean;
  isNativeTtsEnabled: boolean;
  setIsBotSpeaking: (value: boolean) => void;
};

export function useTtsQueue(params: UseTtsQueueParams) {
  const { engineMode, classicTtsMode, isClassicTtsEnabled, isNativeTtsEnabled, setIsBotSpeaking } =
    params;
  const ttsPlaybackRef = useRef<TtsPlaybackSession | null>(null);
  const ttsQueue = useRef<string[]>([]);
  const isPlayingTts = useRef(false);

  const isTtsEnabled = useCallback(() => {
    return engineMode === ModeAccess.CLASSIC ? isClassicTtsEnabled : isNativeTtsEnabled;
  }, [engineMode, isClassicTtsEnabled, isNativeTtsEnabled]);

  const processTtsQueue = useCallback(async () => {
    if (!isTtsEnabled()) {
      console.info('[TTS] Skipped because TTS is disabled', { engineMode });
      ttsQueue.current = [];
      isPlayingTts.current = false;
      setIsBotSpeaking(false);
      return;
    }

    if (isPlayingTts.current || ttsQueue.current.length === 0) return;
    isPlayingTts.current = true;
    const text = ttsQueue.current.shift()!;
    setIsBotSpeaking(true);
    try {
      const providerId = getChatTtsProviderId(engineMode, classicTtsMode);
      const provider = getTtsProvider(providerId);
      console.info('[TTS] Using provider', {
        engineMode,
        provider: provider.id,
        textLength: text.length,
      });
      const session = await provider.speak({
        text,
        language: provider.id === 'browser' ? 'nl-NL' : 'nl',
      });
      if (!session) {
        isPlayingTts.current = false;
        if (ttsQueue.current.length === 0) setIsBotSpeaking(false);
        void processTtsQueue();
        return;
      }
      ttsPlaybackRef.current?.stop();
      ttsPlaybackRef.current = session;
      await session.finished;
    } catch (err) {
      console.error(err);
    } finally {
      if (ttsPlaybackRef.current) {
        ttsPlaybackRef.current = null;
      }
      isPlayingTts.current = false;
      if (ttsQueue.current.length === 0) setIsBotSpeaking(false);
      void processTtsQueue();
    }
  }, [classicTtsMode, engineMode, isTtsEnabled, setIsBotSpeaking]);

  const playTtsChunk = useCallback(
    (text: string) => {
      if (!isTtsEnabled() || !text.trim()) return;
      ttsQueue.current.push(text.trim());
      void processTtsQueue();
    },
    [isTtsEnabled, processTtsQueue]
  );

  const clearQueue = useCallback(() => {
    ttsQueue.current = [];
    isPlayingTts.current = false;
  }, []);

  const stopAll = useCallback(() => {
    clearQueue();
    setIsBotSpeaking(false);
    window.speechSynthesis.cancel();
    ttsPlaybackRef.current?.stop();
    ttsPlaybackRef.current = null;
  }, [clearQueue, setIsBotSpeaking]);

  const getState = useCallback(() => {
    return {
      isPlaying: isPlayingTts.current,
      queueLength: ttsQueue.current.length,
    };
  }, []);

  return {
    playTtsChunk,
    clearQueue,
    stopAll,
    getState,
    isTtsEnabled,
  };
}
