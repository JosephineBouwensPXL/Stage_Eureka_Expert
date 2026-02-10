
import React, { useRef, useEffect } from 'react';
import { Message, MessageRole } from '../types';

interface Props {
  messages: Message[];
  isTyping: boolean;
  streamingUserText?: string;
  streamingBotText?: string;
}

const ChatWindow: React.FC<Props> = ({ messages, isTyping, streamingUserText, streamingBotText }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping, streamingUserText, streamingBotText]);

  return (
    <div 
      ref={scrollRef}
      className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-6 bg-slate-50/50 dark:bg-slate-900/30 rounded-[2rem] border-2 border-slate-100/50 dark:border-slate-800 transition-colors"
    >
      {messages.length === 0 && !streamingUserText && !streamingBotText && (
        <div className="flex flex-col items-center justify-center h-full text-center p-8 opacity-50">
          <div className="w-32 h-32 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-sm">
             <i className="fa-solid fa-lightbulb text-5xl text-clever-yellow"></i>
          </div>
          <h3 className="text-3xl font-black text-slate-800 dark:text-slate-200">Klaar om te leren?</h3>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium max-w-xs">Plak je lesstof en laat ons samen de wereld ontdekken!</p>
        </div>
      )}

      {messages.map((msg) => (
        <div 
          key={msg.id}
          className={`flex ${msg.role === MessageRole.USER ? 'justify-end' : 'justify-start'}`}
        >
          <div 
            className={`chat-bubble p-6 shadow-sm ${
              msg.role === MessageRole.USER 
                ? 'bg-clever-magenta text-white rounded-br-none' 
                : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-2 border-slate-100 dark:border-slate-700 rounded-bl-none'
            }`}
          >
            <p className="text-lg leading-relaxed whitespace-pre-wrap font-medium">
              {msg.text}
            </p>
            <div className={`text-[10px] mt-2 font-black uppercase tracking-widest opacity-40 ${msg.role === MessageRole.USER ? 'text-right' : 'text-left'}`}>
              {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      ))}

      {streamingUserText && (
        <div className="flex justify-end animate-in fade-in slide-in-from-right-4">
          <div className="chat-bubble p-6 shadow-sm bg-clever-magenta/80 text-white rounded-br-none italic">
            {streamingUserText}...
          </div>
        </div>
      )}

      {streamingBotText && (
        <div className="flex justify-start animate-in fade-in slide-in-from-left-4">
          <div className="chat-bubble p-6 shadow-sm bg-white dark:bg-slate-800 text-clever-dark dark:text-slate-100 border-2 border-clever-blue/30 dark:border-clever-blue/20 rounded-bl-none">
            {streamingBotText}
          </div>
        </div>
      )}

      {isTyping && !streamingBotText && (
        <div className="flex justify-start">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl rounded-bl-none flex items-center space-x-2 border-2 border-slate-100 dark:border-slate-700">
            <div className="w-2.5 h-2.5 bg-clever-blue rounded-full animate-bounce"></div>
            <div className="w-2.5 h-2.5 bg-clever-magenta rounded-full animate-bounce [animation-delay:0.2s]"></div>
            <div className="w-2.5 h-2.5 bg-clever-yellow rounded-full animate-bounce [animation-delay:0.4s]"></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatWindow;
