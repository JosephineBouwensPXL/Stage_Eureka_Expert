import React, { useState, useEffect, useRef } from 'react';
import { streamChatWithProvider } from '../services/llm';
import { getClassicSttProviderId, getSttProvider } from '../services/speech/stt';
import { getClassicTtsProviderId, getTtsProvider } from '../services/speech/tts';
import { TtsPlaybackSession } from '../services/speech/tts/types';
import { SttCaptureSession } from '../services/speech/stt/types';
import { ClassicSttMode, ClassicTtsMode } from '../types';

interface Props {
  isActive: boolean;
  onClose: () => void;
  onTranscriptionUpdate: (text: string, role: 'user' | 'bot') => void;
  onTurnComplete: (userText: string, botText: string) => void;
  onBotSpeakingChange?: (isSpeaking: boolean) => void;
  studyMaterial?: string;
  sttMode?: ClassicSttMode;
  ttsMode?: ClassicTtsMode;
  ttsEnabled?: boolean;
}

const ClassicVoiceInterface: React.FC<Props> = ({
  isActive,
  onClose,
  onTranscriptionUpdate,
  onTurnComplete,
  onBotSpeakingChange,
  studyMaterial,
  sttMode = 'local',
  ttsMode = 'browser',
  ttsEnabled = true,
}) => {
  const isLikelyBadTranscript = (value: string): boolean => {
    const text = value.trim();
    if (!text) return true;
    if (text.length > 220 && !/[.!?]/.test(text)) return true;
    const words = text.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length >= 6) {
      const uniqueRatio = new Set(words).size / words.length;
      if (uniqueRatio < 0.45) return true;
    }
    return false;
  };

  const resolvedSttMode: ClassicSttMode = sttMode === 'browser' ? 'browser' : 'local';
  const resolvedTtsMode: ClassicTtsMode = ttsMode === 'local' ? 'local' : 'browser';

  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sttSessionRef = useRef<SttCaptureSession | null>(null);

  const [isBotTalking, setIsBotTalking] = useState(false);
  const speechQueue = useRef<string[]>([]);
  const isSpeechPlaying = useRef(false);
  const ttsPlaybackRef = useRef<TtsPlaybackSession | null>(null);

  useEffect(() => {
    onBotSpeakingChange?.(isBotTalking);
  }, [isBotTalking, onBotSpeakingChange]);

  const processSpeechQueue = () => {
    if (!ttsEnabled) {
      speechQueue.current = [];
      isSpeechPlaying.current = false;
      setIsBotTalking(false);
      return;
    }

    if (isSpeechPlaying.current || speechQueue.current.length === 0) {
      if (speechQueue.current.length === 0 && isSpeechPlaying.current === false) {
        setIsBotTalking(false);
      }
      return;
    }

    isSpeechPlaying.current = true;
    setIsBotTalking(true);
    const text = speechQueue.current.shift()!;

    void (async () => {
      try {
        const provider = getTtsProvider(getClassicTtsProviderId(resolvedTtsMode));
        const session = await provider.speak({
          text,
          language: provider.id === 'browser' ? 'nl-NL' : 'nl',
        });
        if (!session) {
          isSpeechPlaying.current = false;
          processSpeechQueue();
          return;
        }
        ttsPlaybackRef.current?.stop();
        ttsPlaybackRef.current = session;
        await session.finished;
      } catch (error) {
        console.error(error);
      } finally {
        ttsPlaybackRef.current = null;
        isSpeechPlaying.current = false;
        processSpeechQueue();
      }
    })();
  };

  const queueSpeech = (text: string) => {
    if (!ttsEnabled || !text.trim()) return;
    speechQueue.current.push(text);
    processSpeechQueue();
  };

  const stopListening = () => {
    sttSessionRef.current?.stop();
    sttSessionRef.current = null;
    setIsListening(false);
  };

  const startListening = async () => {
    try {
      const provider = getSttProvider(getClassicSttProviderId(resolvedSttMode));
      const session = await provider.captureOnce({
        language: resolvedSttMode === 'browser' ? 'nl-NL' : 'nl',
        maxDurationMs: 6500,
        isLikelyBadTranscript,
        getMediaStream: async () => {
          if (!mediaStreamRef.current) {
            mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
          }
          return mediaStreamRef.current;
        },
      });
      sttSessionRef.current = session;
      setIsListening(true);
      const transcript = await session.result;
      sttSessionRef.current = null;
      setIsListening(false);

      if (!transcript) {
        if (isActive && !isProcessing && !isBotTalking) startListening();
        return;
      }

      onTranscriptionUpdate(transcript, 'user');
      await handleVoiceInput(transcript);
    } catch (err) {
      console.error(err);
      setIsListening(false);
      const reason = err instanceof Error ? err.message : String(err);
      if (reason.includes('niet beschikbaar')) {
        alert(reason);
        onClose();
        return;
      }
      if (isActive && !isProcessing && !isBotTalking) {
        startListening();
      }
    }
  };

  const handleVoiceInput = async (text: string) => {
    setIsProcessing(true);
    let fullBotResponse = '';
    let ttsBuffer = '';

    const flushSpeech = (force = false) => {
      const trimmed = ttsBuffer.trim();
      if (!trimmed) return;
      const hasSentenceBoundary = /[.!?]\s*$/.test(ttsBuffer);
      const isFirstChunk = !isSpeechPlaying.current && speechQueue.current.length === 0;
      const minChunkChars = isFirstChunk ? 55 : 110;

      if (force || (trimmed.length >= minChunkChars && hasSentenceBoundary)) {
        queueSpeech(trimmed);
        ttsBuffer = '';
      }
    };

    try {
      const stream = streamChatWithProvider('local-ollama', {
        message: text,
        chatHistory: [],
        studyMaterial,
      });

      for await (const chunk of stream) {
        fullBotResponse += chunk;
        onTranscriptionUpdate(fullBotResponse, 'bot');
        ttsBuffer += chunk;
        flushSpeech(false);
      }
      flushSpeech(true);

      onTurnComplete(text, fullBotResponse);

      // Wait for speech to finish before potentially re-listening
      const checkSpeechFinished = setInterval(() => {
        if (!isSpeechPlaying.current && speechQueue.current.length === 0) {
          clearInterval(checkSpeechFinished);
          if (isActive) startListening();
        }
      }, 500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (ttsEnabled) return;

    speechQueue.current = [];
    isSpeechPlaying.current = false;
    setIsBotTalking(false);
    window.speechSynthesis.cancel();
    ttsPlaybackRef.current?.stop();
    ttsPlaybackRef.current = null;
  }, [ttsEnabled]);

  useEffect(() => {
    if (isActive) {
      startListening();
    } else {
      stopListening();
      window.speechSynthesis.cancel();
      ttsPlaybackRef.current?.stop();
      ttsPlaybackRef.current = null;
      setIsBotTalking(false);
      speechQueue.current = [];
    }
    return () => {
      stopListening();
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      window.speechSynthesis.cancel();
      ttsPlaybackRef.current?.stop();
      ttsPlaybackRef.current = null;
    };
  }, [isActive, resolvedTtsMode, ttsEnabled]);

  if (!isActive) return null;

  return (
    <div className="mb-2 animate-in slide-in-from-top duration-500">
      <div className="flex items-center justify-between gap-4 rounded-full border border-studybuddy-magenta/18 bg-white/88 dark:bg-slate-900/78 backdrop-blur-sm px-5 py-2.5 shadow-sm">
        <div className="min-w-0 flex items-center gap-3">
          <div
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${isListening ? 'bg-studybuddy-yellow animate-pulse' : isBotTalking ? 'bg-studybuddy-magenta animate-pulse' : 'bg-slate-300 dark:bg-slate-600'}`}
          ></div>
          <div className="min-w-0 flex items-baseline gap-3">
            <span className="shrink-0 text-[11px] font-black uppercase tracking-[0.22em] text-studybuddy-magenta/80">
              Classic Mode
            </span>
            <span className="shrink-0 text-sm font-black text-studybuddy-dark dark:text-white">
              {isProcessing
                ? 'Verwerken...'
                : isBotTalking
                  ? 'Eureka spreekt...'
                  : isListening
                    ? 'Zeg iets...'
                    : 'Wachten...'}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center space-x-3">
          <div className="flex space-x-1 items-end h-5">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className={`w-1 rounded-full ${isListening || isBotTalking ? 'bg-studybuddy-magenta/45 animate-bounce' : 'bg-slate-300/70 dark:bg-slate-600/70 opacity-60'}`}
                style={{ height: `${30 + Math.random() * 70}%`, animationDelay: `${i * 0.1}s` }}
              ></div>
            ))}
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 rounded-full border border-slate-200 bg-white text-slate-500 transition-all hover:border-studybuddy-magenta/30 hover:text-studybuddy-magenta dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-studybuddy-magenta/30 dark:hover:text-studybuddy-magenta"
          >
            <i className="fa-solid fa-microphone-slash text-sm"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClassicVoiceInterface;
