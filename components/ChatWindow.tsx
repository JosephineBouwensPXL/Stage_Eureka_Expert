import React, { useRef, useEffect } from 'react';
import { Message, MessageRole } from '../types';

interface Props {
  messages: Message[];
  isTyping: boolean;
  streamingUserText?: string;
  streamingBotText?: string;
}

const ChatWindow: React.FC<Props> = ({
  messages,
  isTyping,
  streamingUserText,
  streamingBotText,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping, streamingUserText, streamingBotText]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-3 bg-slate-50/35 dark:bg-slate-900/20 rounded-[1.35rem] border border-slate-100/60 dark:border-slate-800 transition-colors"
    >
      {messages.length === 0 && !streamingUserText && !streamingBotText && (
        <div className="flex flex-col items-center justify-center h-full text-center p-5 opacity-50">
          <div className="w-24 h-24 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 shadow-sm">
            <i className="fa-solid fa-lightbulb text-4xl text-studybuddy-yellow"></i>
          </div>
          <h3 className="text-3xl font-semibold text-slate-800 dark:text-slate-200">
            Klaar om te leren?
          </h3>
          <p className="mt-2 max-w-xs text-base text-slate-500 dark:text-slate-400">
            Plak je lesstof en laat ons samen de wereld ontdekken!
          </p>
        </div>
      )}

      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex ${msg.role === MessageRole.USER ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`chat-bubble px-4 py-2.5 shadow-sm ${
              msg.role === MessageRole.USER
                ? 'bg-studybuddy-magenta text-white rounded-br-none'
                : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-100 dark:border-slate-700 rounded-bl-none'
            }`}
          >
            <p className="text-lg leading-6 whitespace-pre-wrap font-normal">{msg.text}</p>
            <div
              className={`mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] opacity-35 ${msg.role === MessageRole.USER ? 'text-right' : 'text-left'}`}
            >
              {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      ))}

      {streamingUserText && (
        <div className="flex justify-end animate-in fade-in slide-in-from-right-4">
          <div className="chat-bubble px-4 py-2.5 shadow-sm bg-studybuddy-magenta/80 text-white rounded-br-none italic text-lg leading-6">
            {streamingUserText}...
          </div>
        </div>
      )}

      {streamingBotText && (
        <div className="flex justify-start animate-in fade-in slide-in-from-left-4">
          <div className="chat-bubble px-4 py-2.5 shadow-sm bg-white dark:bg-slate-800 text-studybuddy-dark dark:text-slate-100 border border-studybuddy-blue/30 dark:border-studybuddy-blue/20 rounded-bl-none text-lg leading-6">
            {streamingBotText}
          </div>
        </div>
      )}

      {isTyping && !streamingBotText && (
        <div className="flex justify-start">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-[1.25rem] rounded-bl-none flex items-center space-x-1.5 border border-slate-100 dark:border-slate-700">
            <div className="w-2 h-2 bg-studybuddy-blue rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-studybuddy-magenta rounded-full animate-bounce [animation-delay:0.2s]"></div>
            <div className="w-2 h-2 bg-studybuddy-yellow rounded-full animate-bounce [animation-delay:0.4s]"></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatWindow;
