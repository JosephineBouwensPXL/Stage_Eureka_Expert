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
    <div className="bg-studybuddy-magenta text-white px-8 py-5 rounded-[2rem] mb-6 flex items-center justify-between shadow-xl border-4 border-white animate-in slide-in-from-top duration-500">
      <div className="flex items-center space-x-6">
        <div className="relative">
          <div
            className={`w-6 h-6 rounded-full shadow-[0_0_15px] ${isListening ? 'bg-studybuddy-yellow animate-pulse shadow-studybuddy-yellow' : isBotTalking ? 'bg-white animate-ping shadow-white' : 'bg-slate-400'}`}
          ></div>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">
            Classic Mode
          </span>
          <span className="text-xl font-black">
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

      <div className="flex items-center space-x-6">
        <div className="flex space-x-1.5 items-end h-8">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className={`w-1.5 bg-white/40 rounded-full ${isListening || isBotTalking ? 'animate-bounce' : 'opacity-20'}`}
              style={{ height: `${30 + Math.random() * 70}%`, animationDelay: `${i * 0.1}s` }}
            ></div>
          ))}
        </div>
        <button
          onClick={onClose}
          className="bg-white/20 hover:bg-white/40 w-14 h-14 rounded-2xl transition-all flex items-center justify-center shadow-lg active:scale-90"
        >
          <i className="fa-solid fa-microphone-slash text-2xl"></i>
        </button>
      </div>
    </div>
  );
};

export default ClassicVoiceInterface;
