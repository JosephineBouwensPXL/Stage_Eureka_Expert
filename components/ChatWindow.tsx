import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message, MessageRole } from '../types';

interface Props {
  messages: Message[];
  isTyping: boolean;
  streamingUserText?: string;
  streamingBotText?: string;
}

function renderMarkdownText(text: string, isUserMessage = false) {
  const normalizedText = text.replace(/\n/g, '  \n');

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="text-lg leading-6 font-normal">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        ul: ({ children }) => <ul className="list-disc pl-6 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-6 space-y-1">{children}</ol>,
        li: ({ children }) => <li className="text-lg leading-6">{children}</li>,
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className={isUserMessage ? 'underline' : 'text-studybuddy-blue underline'}
          >
            {children}
          </a>
        ),
        code: ({ children }) => (
          <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-[0.95em]">
            {children}
          </code>
        ),
      }}
    >
      {normalizedText}
    </ReactMarkdown>
  );
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
            <div className="space-y-3">{renderMarkdownText(msg.text, msg.role === MessageRole.USER)}</div>
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
            <div className="space-y-3">{renderMarkdownText(streamingBotText)}</div>
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
