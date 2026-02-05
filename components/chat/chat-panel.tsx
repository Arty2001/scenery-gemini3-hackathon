'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useChat } from '@/lib/hooks/use-chat';
import { ChatMessage } from './chat-message';
import { ChatInput } from './chat-input';
import { useCompositionStore } from '@/lib/composition/store';
import type { MediaItem } from '@/lib/composition/types';

const VOICE_OPTIONS = ['Kore', 'Charon', 'Fenrir', 'Aoede', 'Puck'] as const;

export function ChatPanel() {
  const { messages, isLoading, sendMessage, clearMessages } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Voiceover popover state
  const [showVoiceover, setShowVoiceover] = useState(false);
  const [voiceoverText, setVoiceoverText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState<string>('Kore');
  const [isGenerating, setIsGenerating] = useState(false);
  const [voiceoverStatus, setVoiceoverStatus] = useState<string | null>(null);

  // Composition store access
  const projectId = useCompositionStore((s) => s.projectId);
  const compositionId = useCompositionStore((s) => s.id);
  const fps = useCompositionStore((s) => s.fps);
  const currentFrame = useCompositionStore((s) => s.currentFrame);
  const tracks = useCompositionStore((s) => s.tracks);
  const addTrack = useCompositionStore((s) => s.addTrack);
  const addItem = useCompositionStore((s) => s.addItem);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Pre-fill voiceover text with last assistant message
  const handleOpenVoiceover = useCallback(() => {
    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.role === 'assistant');
    setVoiceoverText(lastAssistant?.content ?? '');
    setVoiceoverStatus(null);
    setShowVoiceover(true);
  }, [messages]);

  const handleGenerateVoiceover = useCallback(async () => {
    if (!voiceoverText.trim() || !projectId) return;

    setIsGenerating(true);
    setVoiceoverStatus(null);

    try {
      const response = await fetch('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: voiceoverText.trim(),
          voiceName: selectedVoice,
          projectId,
          compositionId,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to generate voiceover');
      }

      const { url, durationInSeconds } = (await response.json()) as {
        url: string;
        durationInSeconds: number;
      };

      // Find or create audio track
      let audioTrack = tracks.find((t) => t.type === 'audio');
      if (!audioTrack) {
        addTrack({
          name: 'Audio',
          type: 'audio',
          locked: false,
          visible: true,
          items: [],
        });
        // Re-read tracks after adding
        audioTrack = useCompositionStore.getState().tracks.find((t) => t.type === 'audio');
      }

      if (audioTrack) {
        addItem(audioTrack.id, {
          type: 'audio',
          src: url,
          from: currentFrame,
          durationInFrames: Math.round(durationInSeconds * fps),
          volume: 1,
          startFrom: 0,
        } as Omit<MediaItem, 'id'>);
      }

      setVoiceoverStatus('Voiceover added to composition');
      setShowVoiceover(false);
    } catch (error) {
      setVoiceoverStatus(
        error instanceof Error ? error.message : 'Generation failed'
      );
    } finally {
      setIsGenerating(false);
    }
  }, [
    voiceoverText,
    selectedVoice,
    projectId,
    compositionId,
    fps,
    currentFrame,
    tracks,
    addTrack,
    addItem,
  ]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 28 28" fill="none">
            <path d="M14 28C14 26.0633 13.6267 24.2433 12.88 22.54C12.1567 20.8367 11.165 19.355 9.905 18.095C8.645 16.835 7.16333 15.8433 5.46 15.12C3.75667 14.3733 1.93667 14 0 14C1.93667 14 3.75667 13.6383 5.46 12.915C7.16333 12.1683 8.645 11.165 9.905 9.905C11.165 8.645 12.1567 7.16333 12.88 5.46C13.6267 3.75667 14 1.93667 14 0C14 1.93667 14.3617 3.75667 15.085 5.46C15.8317 7.16333 16.835 8.645 18.095 9.905C19.355 11.165 20.8367 12.1683 22.54 12.915C24.2433 13.6383 26.0633 14 28 14C26.0633 14 24.2433 14.3733 22.54 15.12C20.8367 15.8433 19.355 16.835 18.095 18.095C16.835 19.355 15.8317 20.8367 15.085 22.54C14.3617 24.2433 14 26.0633 14 28Z" fill="url(#gemini-hdr)"/>
            <defs><linearGradient id="gemini-hdr" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse"><stop stopColor="#4285F4"/><stop offset="0.5" stopColor="#9B72CB"/><stop offset="1" stopColor="#D96570"/></linearGradient></defs>
          </svg>
          <h3 className="text-sm font-semibold">Gemini 3</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenVoiceover}
            title="Generate Voiceover"
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
          </button>
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Voiceover Popover */}
      {showVoiceover && (
        <div className="border-b bg-muted/50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Generate Voiceover</span>
            <button
              onClick={() => setShowVoiceover(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Close
            </button>
          </div>
          <textarea
            value={voiceoverText}
            onChange={(e) => setVoiceoverText(e.target.value)}
            placeholder="Enter text for voiceover..."
            rows={3}
            className="w-full resize-none rounded-md border bg-background px-2 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <div className="flex items-center gap-2">
            <select
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              className="rounded-md border bg-background px-2 py-1 text-xs"
            >
              {VOICE_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <button
              onClick={handleGenerateVoiceover}
              disabled={isGenerating || !voiceoverText.trim() || !projectId}
              className="ml-auto rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </div>
      )}

      {/* Voiceover status message */}
      {voiceoverStatus && (
        <div className="border-b px-3 py-1.5 text-xs text-muted-foreground">
          {voiceoverStatus}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center gap-4 pt-8">
            <p className="text-center text-sm text-muted-foreground">
              Describe the video you want to create, or ask me to modify the
              current composition.
            </p>
            <div className="flex flex-wrap justify-center gap-2 px-2">
              {[
                'Create a product demo video showcasing my components',
                'Add all my components to the timeline with animations',
                'Make a 30-second feature walkthrough with text overlays',
              ].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  disabled={isLoading}
                  className="rounded-full border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={sendMessage} disabled={isLoading} />
    </div>
  );
}
