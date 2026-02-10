
import React, { useState, useEffect, useRef } from 'react';
import { sendMessageStreamToGemini } from '../services/geminiService';

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
  const recognitionRef = useRef<any>(null);
  
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

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert("Browser STT is niet beschikbaar.");
      onClose();
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'nl-NL';
    recognition.continuous = false; // Stop after first sentence to respond faster
    recognition.interimResults = true;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join('');
      onTranscriptionUpdate(transcript, 'user');

      if (event.results[0].isFinal) {
        recognition.stop();
        handleVoiceInput(transcript);
      }
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleVoiceInput = async (text: string) => {
    setIsProcessing(true);
    let fullBotResponse = '';
    let processedLength = 0;
    
    try {
      const stream = sendMessageStreamToGemini(text, [], studyMaterial);
      
      for await (const chunk of stream) {
        fullBotResponse += chunk;
        onTranscriptionUpdate(fullBotResponse, 'bot');

        // Sentence-based chunking for speed
        const currentUnprocessed = fullBotResponse.substring(processedLength);
        const sentenceMatch = currentUnprocessed.match(/[^.!?]+[.!?]/);
        if (sentenceMatch) {
          const sentence = sentenceMatch[0];
          queueSpeech(sentence);
          processedLength += sentence.length;
        }
      }

      // Handle leftovers
      const remaining = fullBotResponse.substring(processedLength);
      if (remaining.trim()) {
        queueSpeech(remaining);
      }

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
      if (recognitionRef.current) recognitionRef.current.stop();
      window.speechSynthesis.cancel();
      setIsBotTalking(false);
      speechQueue.current = [];
    }
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
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
