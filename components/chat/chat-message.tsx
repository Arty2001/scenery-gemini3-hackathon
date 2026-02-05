'use client';

import { ChatMessage as ChatMessageType } from '@/lib/hooks/use-chat';

interface ChatMessageProps {
  message: ChatMessageType;
}

function GeminiIcon({ size = 14 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 28 28" fill="none" className="flex-shrink-0">
      <path d="M14 28C14 26.0633 13.6267 24.2433 12.88 22.54C12.1567 20.8367 11.165 19.355 9.905 18.095C8.645 16.835 7.16333 15.8433 5.46 15.12C3.75667 14.3733 1.93667 14 0 14C1.93667 14 3.75667 13.6383 5.46 12.915C7.16333 12.1683 8.645 11.165 9.905 9.905C11.165 8.645 12.1567 7.16333 12.88 5.46C13.6267 3.75667 14 1.93667 14 0C14 1.93667 14.3617 3.75667 15.085 5.46C15.8317 7.16333 16.835 8.645 18.095 9.905C19.355 11.165 20.8367 12.1683 22.54 12.915C24.2433 13.6383 26.0633 14 28 14C26.0633 14 24.2433 14.3733 22.54 15.12C20.8367 15.8433 19.355 16.835 18.095 18.095C16.835 19.355 15.8317 20.8367 15.085 22.54C14.3617 24.2433 14 26.0633 14 28Z" fill="url(#gemini-msg)"/>
      <defs><linearGradient id="gemini-msg" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse"><stop stopColor="#4285F4"/><stop offset="0.5" stopColor="#9B72CB"/><stop offset="1" stopColor="#D96570"/></linearGradient></defs>
    </svg>
  );
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isError = message.status === 'error';
  const isStreaming = message.status === 'streaming';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      {!isUser && (
        <div className="mr-2 mt-2">
          <GeminiIcon />
        </div>
      )}
      <div
        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
          isError
            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            : isUser
              ? 'bg-blue-600 text-white'
              : 'bg-muted text-foreground'
        }`}
      >
        {isError && (
          <span className="mr-1 inline-block" aria-label="Error">
            ⚠
          </span>
        )}
        <span className="whitespace-pre-wrap">{message.content}</span>
        {isStreaming && (
          <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-current" />
        )}
      </div>
    </div>
  );
}
