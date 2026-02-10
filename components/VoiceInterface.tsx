
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { SYSTEM_PROMPT } from '../constants';

// Helper functions for audio
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
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

interface Props {
  isActive: boolean;
  onClose: () => void;
  onTranscriptionUpdate: (text: string, role: 'user' | 'bot') => void;
  onTurnComplete: (userText: string, botText: string) => void;
  onBotSpeakingChange?: (isSpeaking: boolean) => void;
  studyMaterial?: string;
}

const VoiceInterface: React.FC<Props> = ({ isActive, onClose, onTranscriptionUpdate, onTurnComplete, onBotSpeakingChange, studyMaterial }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<{ input: AudioContext; output: AudioContext } | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef(0);
  const currentInputTranscription = useRef('');
  const currentOutputTranscription = useRef('');

  useEffect(() => {
    onBotSpeakingChange?.(isTalking);
  }, [isTalking]);

  const startSession = async () => {
    setIsConnecting(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    await Promise.all([inputCtx.resume(), outputCtx.resume()]);
    audioContextRef.current = { input: inputCtx, output: outputCtx };

    const dynamicInstruction = studyMaterial ? `${SYSTEM_PROMPT}\n\nGEBRUIK DIT LESMATERIAAL:\n${studyMaterial}` : SYSTEM_PROMPT;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsConnecting(false);
            const source = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = (e) => {
              const resampledData = resample(e.inputBuffer.getChannelData(0), inputCtx.sampleRate, 16000);
              const int16 = new Int16Array(resampledData.length);
              for (let i = 0; i < resampledData.length; i++) int16[i] = resampledData[i] * 32768;
              sessionPromise.then(session => session.sendRealtimeInput({ media: { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' } }));
            };
            source.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.outputTranscription) {
              currentOutputTranscription.current += message.serverContent.outputTranscription.text;
              onTranscriptionUpdate(currentOutputTranscription.current, 'bot');
            } else if (message.serverContent?.inputTranscription) {
              currentInputTranscription.current += message.serverContent.inputTranscription.text;
              onTranscriptionUpdate(currentInputTranscription.current, 'user');
            }
            if (message.serverContent?.turnComplete) {
              onTurnComplete(currentInputTranscription.current, currentOutputTranscription.current);
              currentInputTranscription.current = ''; currentOutputTranscription.current = '';
            }
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              setIsTalking(true);
              const { output } = audioContextRef.current!;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, output.currentTime);
              const buffer = await decodeAudioData(decode(base64Audio), output, 24000, 1);
              const source = output.createBufferSource();
              source.buffer = buffer;
              source.connect(output.destination);
              source.onended = () => { 
                sourcesRef.current.delete(source); 
                if (sourcesRef.current.size === 0) setIsTalking(false); 
              };
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }
            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
              sourcesRef.current.clear(); nextStartTimeRef.current = 0; setIsTalking(false);
            }
          },
          onerror: (e) => { console.error(e); setIsConnecting(false); },
          onclose: () => { setIsConnecting(false); onClose(); },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
          systemInstruction: dynamicInstruction,
          inputAudioTranscription: {}, outputAudioTranscription: {},
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err) { setIsConnecting(false); onClose(); }
  };

  useEffect(() => {
    if (isActive) startSession();
    else {
      if (sessionRef.current) { try { sessionRef.current.close(); } catch(e) {} sessionRef.current = null; }
      if (audioContextRef.current) { audioContextRef.current.input.close(); audioContextRef.current.output.close(); audioContextRef.current = null; }
      currentInputTranscription.current = ''; currentOutputTranscription.current = '';
      setIsTalking(false);
    }
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div className="bg-clever-blue text-white px-8 py-5 rounded-[2rem] mb-6 flex items-center justify-between shadow-xl border-4 border-white animate-in slide-in-from-top duration-500">
      <div className="flex items-center space-x-6">
        <div className="relative">
          <div className="w-6 h-6 bg-clever-yellow rounded-full animate-pulse shadow-[0_0_15px_#fbc02d]"></div>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Clever Live</span>
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
