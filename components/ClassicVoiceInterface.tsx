
import React, { useState, useEffect, useRef } from 'react';
import { sendMessageStreamToLocalLLM, transcribeAudioWithLocalStt } from '../services/localSpeechService';

interface Props {
  isActive: boolean;
  onClose: () => void;
  onTranscriptionUpdate: (text: string, role: 'user' | 'bot') => void;
  onTurnComplete: (userText: string, botText: string) => void;
  onBotSpeakingChange?: (isSpeaking: boolean) => void;
  studyMaterial?: string;
}

const ClassicVoiceInterface: React.FC<Props> = ({ 
  isActive, 
  onClose, 
  onTranscriptionUpdate, 
  onTurnComplete, 
  onBotSpeakingChange,
  studyMaterial 
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const stopTimerRef = useRef<number | null>(null);
  
  const [isBotTalking, setIsBotTalking] = useState(false);
  const speechQueue = useRef<string[]>([]);
  const isSpeechPlaying = useRef(false);

  useEffect(() => {
    onBotSpeakingChange?.(isBotTalking);
  }, [isBotTalking, onBotSpeakingChange]);

  const processSpeechQueue = () => {
    if (isSpeechPlaying.current || speechQueue.current.length === 0) {
      if (speechQueue.current.length === 0 && isSpeechPlaying.current === false) {
        setIsBotTalking(false);
      }
      return;
    }
    
    isSpeechPlaying.current = true;
    setIsBotTalking(true);
    const text = speechQueue.current.shift()!;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'nl-NL';
    utterance.rate = 1.0;
    
    utterance.onend = () => {
      isSpeechPlaying.current = false;
      processSpeechQueue();
    };

    utterance.onerror = () => {
      isSpeechPlaying.current = false;
      processSpeechQueue();
    };

    window.speechSynthesis.speak(utterance);
  };

  const queueSpeech = (text: string) => {
    if (!text.trim()) return;
    speechQueue.current.push(text);
    processSpeechQueue();
  };

  const stopListening = () => {
    if (stopTimerRef.current) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsListening(false);
  };

  const startListening = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      alert("Audio-opname is niet beschikbaar in deze browser.");
      onClose();
      return;
    }

    try {
      if (!mediaStreamRef.current) {
        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      audioChunksRef.current = [];
      const preferredMime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const recorder = preferredMime
        ? new MediaRecorder(mediaStreamRef.current, { mimeType: preferredMime })
        : new MediaRecorder(mediaStreamRef.current);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        setIsListening(false);
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size < 1024) {
          if (isActive) startListening();
          return;
        }

        try {
          const transcript = await transcribeAudioWithLocalStt(blob, 'nl');
          if (!transcript.trim()) {
            if (isActive) startListening();
            return;
          }
          onTranscriptionUpdate(transcript, 'user');
          await handleVoiceInput(transcript);
        } catch (err) {
          console.error(err);
        }
      };

      recorder.start();
      setIsListening(true);

      // Basic chunk duration for the first local STT version.
      stopTimerRef.current = window.setTimeout(() => stopListening(), 4500);
    } catch (err) {
      console.error(err);
      setIsListening(false);
    }
  };

  const handleVoiceInput = async (text: string) => {
    setIsProcessing(true);
    let fullBotResponse = '';
    
    try {
      const stream = sendMessageStreamToLocalLLM(text, [], studyMaterial);
      
      for await (const chunk of stream) {
        fullBotResponse += chunk;
        onTranscriptionUpdate(fullBotResponse, 'bot');
      }
      queueSpeech(fullBotResponse);

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
    if (isActive) {
      startListening();
    } else {
      stopListening();
      window.speechSynthesis.cancel();
      setIsBotTalking(false);
      speechQueue.current = [];
    }
    return () => {
      stopListening();
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
      window.speechSynthesis.cancel();
    };
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div className="bg-clever-magenta text-white px-8 py-5 rounded-[2rem] mb-6 flex items-center justify-between shadow-xl border-4 border-white animate-in slide-in-from-top duration-500">
      <div className="flex items-center space-x-6">
        <div className="relative">
          <div className={`w-6 h-6 rounded-full shadow-[0_0_15px] ${isListening ? 'bg-clever-yellow animate-pulse shadow-clever-yellow' : isBotTalking ? 'bg-white animate-ping shadow-white' : 'bg-slate-400'}`}></div>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Classic Mode</span>
          <span className="text-xl font-black">
            {isProcessing ? 'Verwerken...' : isBotTalking ? 'Eureka spreekt...' : isListening ? 'Zeg iets...' : 'Wachten...'}
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
