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
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [ragDebugStatus, setRagDebugStatus] = useState('RAG: nog niet gestart');
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
  const shouldShowSecondaryStatus = Boolean(connectionError) || isConnecting;

  useEffect(() => {
    onBotSpeakingChange?.(isTalking);
  }, [isTalking]);

  const startSession = async () => {
    requestedCloseRef.current = false;
    setConnectionError(null);
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
    const shouldSendInlineStudyMaterial = !!inlineStudyMaterial && !fileSearchStoreName;
    console.info('[RAG][Live] Session routing', {
      selectedFiles: ragSelectedStudyItems.length,
      usesGeminiFileSearch: !!fileSearchStoreName,
      fileSearchStoreName,
      usesInlineStudyMaterial: shouldSendInlineStudyMaterial,
    });
    if (fileSearchStoreName) {
      setRagDebugStatus(`RAG: Gemini File Search actief (${fileSearchStoreName})`);
    } else if (shouldSendInlineStudyMaterial) {
      setRagDebugStatus('RAG: fallback inline context (geen file search store)');
    } else {
      setRagDebugStatus('RAG: geen geselecteerd studiemateriaal');
    }
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
            setConnectionError(error instanceof Error ? error.message : String(error));
          },
          onClose: () => {
            setIsConnecting(false);
            if (!requestedCloseRef.current) {
              setConnectionError((prev) => prev ?? 'Live sessie is onverwacht verbroken.');
            }
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
    } catch (error) {
      console.error('[Native Voice] startSession failed', error);
      setIsConnecting(false);
      setConnectionError(
        error instanceof Error ? error.message : 'Live sessie kon niet gestart worden.'
      );
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
      setConnectionError(null);
      setRagDebugStatus('RAG: sessie gestopt');
    }
  }, [isActive, ttsEnabled]);

  if (!isActive) return null;

  return (
    <div className="mb-2 animate-in slide-in-from-top duration-500">
      <div className="flex items-center justify-between gap-4 rounded-full border border-studybuddy-blue/18 bg-white/88 dark:bg-slate-900/78 backdrop-blur-sm px-5 py-2.5 shadow-sm">
        <div className="min-w-0 flex items-center gap-3">
          <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-studybuddy-blue animate-pulse"></div>
          <div className="min-w-0 flex items-baseline gap-3">
            <span className="shrink-0 text-[11px] font-black uppercase tracking-[0.22em] text-studybuddy-blue/80">
              Live
            </span>
            <span className="shrink-0 text-sm font-black text-studybuddy-dark dark:text-white">
              {connectionError ? 'Verbinding mislukt' : isConnecting ? 'Verbinden...' : 'Ik luister...'}
            </span>
            {shouldShowSecondaryStatus && (
              <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                {connectionError ?? ragDebugStatus}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center space-x-3">
          <div className="flex space-x-1 items-end h-5">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="w-1 bg-studybuddy-blue/35 rounded-full animate-bounce"
                style={{ height: `${30 + Math.random() * 70}%`, animationDelay: `${i * 0.1}s` }}
              ></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceInterface;
