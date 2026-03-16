import React, { useState, useEffect, useRef } from 'react';
import { SYSTEM_PROMPT } from '../constants';
import { getDefaultLiveVoiceProviderId, getLiveVoiceProvider } from '../services/llm/live';
import { syncSelectedStudyItemsToGeminiFileSearch } from '../services/llm/geminiFileSearch';
import { StudyItem } from '../types';

function decode(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++)
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
  }
  return buffer;
}

function resample(data: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (Math.abs(fromRate - toRate) < 1) return data;
  const ratio = fromRate / toRate;
  const newLength = Math.round(data.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const pos = i * ratio;
    const index = Math.floor(pos);
    const frac = pos - index;
    if (index + 1 < data.length) result[i] = data[index] * (1 - frac) + data[index + 1] * frac;
    else result[i] = data[index] || 0;
  }
  return result;
}

function truncateText(text: string, maxChars: number): string {
  const clean = text?.trim() ?? '';
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, maxChars)}\n\n[Ingekort voor live sessie]`;
}

interface Props {
  isActive: boolean;
  onClose: () => void;
  onTranscriptionUpdate: (text: string, role: 'user' | 'bot') => void;
  onTurnComplete: (userText: string, botText: string) => void;
  onBotSpeakingChange?: (isSpeaking: boolean) => void;
  studyMaterial?: string;
  ttsEnabled?: boolean;
  ragUserId?: string;
  ragSelectedStudyItems?: StudyItem[];
}

const VoiceInterface: React.FC<Props> = ({
  isActive,
  onClose,
  onTranscriptionUpdate,
  onTurnComplete,
  onBotSpeakingChange,
  studyMaterial,
  ttsEnabled = true,
  ragUserId,
  ragSelectedStudyItems = [],
}) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const MAX_INLINE_STUDY_MATERIAL_CHARS = 4000;
  const sessionRef = useRef<{
    close: () => void;
    sendAudioChunk: (data: Uint8Array, mimeType: string) => void;
  } | null>(null);
  const audioContextRef = useRef<{ input: AudioContext; output: AudioContext } | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef(0);
  const currentInputTranscription = useRef('');
  const currentOutputTranscription = useRef('');
  const requestedCloseRef = useRef(false);

  useEffect(() => {
    onBotSpeakingChange?.(isTalking);
  }, [isTalking]);

  const startSession = async () => {
    requestedCloseRef.current = false;
    setIsConnecting(true);
    const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 24000,
    });
    await Promise.all([inputCtx.resume(), outputCtx.resume()]);
    audioContextRef.current = { input: inputCtx, output: outputCtx };

    let fileSearchStoreName: string | undefined;
    if (ragUserId && ragSelectedStudyItems.length > 0) {
      try {
        fileSearchStoreName = await syncSelectedStudyItemsToGeminiFileSearch(
          ragUserId,
          ragSelectedStudyItems
        );
      } catch (error) {
        console.error(
          '[Gemini Live File Search] Synchronisatie mislukt, fallback op inline context.',
          error
        );
      }
    }

    const inlineStudyMaterial = studyMaterial
      ? truncateText(studyMaterial, MAX_INLINE_STUDY_MATERIAL_CHARS)
      : '';
    const shouldSendInlineStudyMaterial = !!inlineStudyMaterial;
    console.info('[RAG][Live] Session routing', {
      selectedFiles: ragSelectedStudyItems.length,
      usesGeminiFileSearch: !!fileSearchStoreName,
      fileSearchStoreName,
      usesInlineStudyMaterial: shouldSendInlineStudyMaterial,
    });
    const dynamicInstruction = shouldSendInlineStudyMaterial
      ? `${SYSTEM_PROMPT}\n\nGEBRUIK DIT LESMATERIAAL:\n${inlineStudyMaterial}`
      : SYSTEM_PROMPT;
    const provider = getLiveVoiceProvider(getDefaultLiveVoiceProviderId());

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = inputCtx.createMediaStreamSource(stream);
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      const session = await provider.connect(
        {
          systemInstruction: dynamicInstruction,
          ttsEnabled,
          fileSearchStoreName,
        },
        {
          onOpen: () => {
            setIsConnecting(false);
          },
          onInputTranscription: (text) => {
            currentInputTranscription.current += text;
            onTranscriptionUpdate(currentInputTranscription.current, 'user');
          },
          onOutputTranscription: (text) => {
            currentOutputTranscription.current += text;
            onTranscriptionUpdate(currentOutputTranscription.current, 'bot');
          },
          onTurnComplete: () => {
            onTurnComplete(currentInputTranscription.current, currentOutputTranscription.current);
            currentInputTranscription.current = '';
            currentOutputTranscription.current = '';
          },
          onAudioChunk: async (base64Audio) => {
            console.info('[Native Voice] Audio chunk received', {
              provider: provider.id,
              source: 'provider-inline-audio',
              base64Length: base64Audio.length,
            });
            setIsTalking(true);
            const { output } = audioContextRef.current!;
            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, output.currentTime);
            const buffer = await decodeAudioData(decode(base64Audio), output, 24000, 1);
            const playbackSource = output.createBufferSource();
            playbackSource.buffer = buffer;
            playbackSource.connect(output.destination);
            playbackSource.onended = () => {
              sourcesRef.current.delete(playbackSource);
              if (sourcesRef.current.size === 0) setIsTalking(false);
            };
            playbackSource.start(nextStartTimeRef.current);
            nextStartTimeRef.current += buffer.duration;
            sourcesRef.current.add(playbackSource);
          },
          onInterrupted: () => {
            sourcesRef.current.forEach((s) => {
              try {
                s.stop();
              } catch {
                // no-op
              }
            });
            sourcesRef.current.clear();
            nextStartTimeRef.current = 0;
            setIsTalking(false);
          },
          onError: (error) => {
            console.error(error);
            setIsConnecting(false);
          },
          onClose: () => {
            setIsConnecting(false);
            if (!requestedCloseRef.current) onClose();
          },
        }
      );
      processor.onaudioprocess = (e) => {
        const resampledData = resample(e.inputBuffer.getChannelData(0), inputCtx.sampleRate, 16000);
        const int16 = new Int16Array(resampledData.length);
        for (let i = 0; i < resampledData.length; i++) int16[i] = resampledData[i] * 32768;
        session.sendAudioChunk(new Uint8Array(int16.buffer), 'audio/pcm;rate=16000');
      };
      source.connect(processor);
      processor.connect(inputCtx.destination);
      sessionRef.current = session;
    } catch {
      setIsConnecting(false);
      onClose();
    }
  };

  useEffect(() => {
    if (isActive) startSession();
    else {
      requestedCloseRef.current = true;
      if (sessionRef.current) {
        try {
          sessionRef.current.close();
        } catch {
          // no-op
        }
        sessionRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.input.close();
        audioContextRef.current.output.close();
        audioContextRef.current = null;
      }
      currentInputTranscription.current = '';
      currentOutputTranscription.current = '';
      setIsTalking(false);
    }
  }, [isActive, ttsEnabled]);

  if (!isActive) return null;

  return (
    <div className="bg-studybuddy-blue text-white px-8 py-5 rounded-[2rem] mb-6 flex items-center justify-between shadow-xl border-4 border-white animate-in slide-in-from-top duration-500">
      <div className="flex items-center space-x-6">
        <div className="relative">
          <div className="w-6 h-6 bg-studybuddy-yellow rounded-full animate-pulse shadow-[0_0_15px_#fbc02d]"></div>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">
            StudyBuddy Live
          </span>
          <span className="text-xl font-black">
            {isConnecting ? 'Verbinden...' : 'Ik luister...'}
          </span>
        </div>
      </div>

      <div className="flex items-center space-x-6">
        <div className="flex space-x-1.5 items-end h-8">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="w-1.5 bg-white/40 rounded-full animate-bounce"
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

export default VoiceInterface;
