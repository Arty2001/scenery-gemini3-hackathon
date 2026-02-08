'use client';

import { useState, useCallback, useRef } from 'react';
import { executeToolCall } from '@/lib/ai/composition-tools';
import { useCompositionStore } from '@/lib/composition/store';
import type { Track } from '@/lib/composition/types';
import type { InteractiveElement } from '@/lib/component-discovery/types';
import { interactiveElementsToString } from '@/lib/component-discovery/extract-interactive-elements';

// =============================================
// Types
// =============================================

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status: 'complete' | 'streaming' | 'error';
  createdAt: Date;
}

export interface CompositionContext {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  tracks: Track[];
  /** Scenes for slide-based editing */
  scenes?: { id: string; name: string; startFrame: number; durationInFrames: number; backgroundColor?: string; transitionType?: string }[];
  components?: { id: string; name: string; category: string; props: string[]; description?: string }[];
  /** Custom HTML components imported by the user */
  customComponents?: { id: string; name: string; category: string | null; description: string | null; html: string }[];
  projectId?: string;
  /** AI model to use for this project (e.g., gemini-3-flash-preview) */
  aiModel?: string;
  /** Current playhead position in frames */
  currentFrame?: number;
  /** Currently selected item ID (if any) */
  selectedItemId?: string | null;
  /** Currently selected scene ID (if any) */
  selectedSceneId?: string | null;
}

interface GeminiMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

// SSE event types from the route handler
interface SSETextEvent {
  type: 'text';
  content: string;
}

interface SSEFunctionCallEvent {
  type: 'function_call';
  calls: { name: string; args: Record<string, unknown> }[];
}

interface SSECompositionEvent {
  type: 'composition';
  data: Record<string, unknown>;
}

interface SSEDoneEvent {
  type: 'done';
}

interface SSEErrorEvent {
  type: 'error';
  message: string;
}

type SSEEvent = SSETextEvent | SSEFunctionCallEvent | SSECompositionEvent | SSEDoneEvent | SSEErrorEvent;

// =============================================
// useChat Hook
// =============================================

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Maintain Gemini-format message history for multi-turn
  const historyRef = useRef<GeminiMessage[]>([]);

  // Cache discovered components for AI context
  const componentsRef = useRef<CompositionContext['components'] | null>(null);
  const customComponentsRef = useRef<CompositionContext['customComponents'] | null>(null);
  const aiModelRef = useRef<string | null>(null);
  const componentsFetchedRef = useRef(false);

  const addUserMessage = useCallback((content: string): string => {
    const id = crypto.randomUUID();
    const message: ChatMessage = {
      id,
      role: 'user',
      content,
      status: 'complete',
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, message]);
    return id;
  }, []);

  const addAssistantMessage = useCallback((): string => {
    const id = crypto.randomUUID();
    const message: ChatMessage = {
      id,
      role: 'assistant',
      content: '',
      status: 'streaming',
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, message]);
    return id;
  }, []);

  const appendToMessage = useCallback((id: string, chunk: string) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === id ? { ...msg, content: msg.content + chunk } : msg
      )
    );
  }, []);

  const completeMessage = useCallback((id: string) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === id ? { ...msg, status: 'complete' as const } : msg
      )
    );
  }, []);

  const failMessage = useCallback((id: string, errorMsg: string) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === id
          ? { ...msg, status: 'error' as const, content: errorMsg }
          : msg
      )
    );
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    historyRef.current = [];
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      setError(null);
      setIsLoading(true);

      const userMsgId = addUserMessage(content);
      const assistantMsgId = addAssistantMessage();

      // Add user message to Gemini history
      historyRef.current.push({
        role: 'user',
        parts: [{ text: content }],
      });

      // Fetch discovered components and custom HTML components once (lazy, on first message)
      if (!componentsFetchedRef.current) {
        componentsFetchedRef.current = true;
        const storeState = useCompositionStore.getState();

        // Fetch project settings (including AI model)
        try {
          const res = await fetch(`/api/projects/${storeState.projectId}`);
          if (res.ok) {
            const data = await res.json();
            aiModelRef.current = data.ai_model || 'gemini-3-pro-preview';
            console.log('[useChat] Fetched project AI model:', data.ai_model, '-> using:', aiModelRef.current);
          } else {
            console.warn('[useChat] Failed to fetch project:', res.status, '- using default model');
            aiModelRef.current = 'gemini-3-pro-preview';
          }
        } catch (err) {
          // Default to pro if fetch fails
          console.warn('[useChat] Error fetching project:', err, '- using default model');
          aiModelRef.current = 'gemini-3-pro-preview';
        }

        // Fetch React components
        try {
          const res = await fetch(`/api/projects/${storeState.projectId}/components`);
          if (res.ok) {
            const data = await res.json();
            console.log('[useChat] Fetched components:', data.length);
            componentsRef.current = data.map((c: {
              id: string;
              componentName: string;
              category?: string;
              props?: { name: string }[];
              description?: string;
              demoProps?: Record<string, unknown>;
              interactiveElements?: InteractiveElement[];
              usesComponents?: string[];
              usedByComponents?: string[];
              relatedComponents?: string[];
            }) => {
              const interactiveStr = c.interactiveElements
                ? interactiveElementsToString(c.interactiveElements)
                : undefined;

              // Debug: Log interactive elements for each component
              if (c.interactiveElements && c.interactiveElements.length > 0) {
                console.log(`[useChat] Component "${c.componentName}" has ${c.interactiveElements.length} interactive elements:`, c.interactiveElements);
                console.log(`[useChat] Formatted for AI:`, interactiveStr);
              }

              return {
                id: c.id,
                name: c.componentName,
                category: c.category ?? 'uncategorized',
                props: (c.props ?? []).map((p: { name: string }) => p.name),
                description: c.description,
                demoProps: c.demoProps,
                interactiveElements: interactiveStr,
                // Component relationships
                usesComponents: c.usesComponents,
                usedByComponents: c.usedByComponents,
                relatedComponents: c.relatedComponents,
              };
            });
          }
        } catch {
          // ignore - AI just won't have component context
        }

        // Fetch custom HTML components
        try {
          const res = await fetch(`/api/projects/${storeState.projectId}/custom-components`);
          if (res.ok) {
            const data = await res.json();
            console.log('[useChat] Fetched custom HTML components:', data.length);
            customComponentsRef.current = data.map((c: {
              id: string;
              name: string;
              category: string | null;
              description: string | null;
              previewHtml: string;
            }) => ({
              id: c.id,
              name: c.name,
              category: c.category,
              description: c.description,
              html: c.previewHtml,
            }));
          }
        } catch {
          // ignore - AI just won't have custom HTML context
        }
      }

      // Always read latest store state for accurate context (not stale prop)
      const latestState = useCompositionStore.getState();
      const ctx: CompositionContext = {
        width: latestState.width,
        height: latestState.height,
        fps: latestState.fps,
        durationInFrames: latestState.durationInFrames,
        tracks: latestState.tracks,
        scenes: latestState.scenes.length > 0 ? latestState.scenes.map(s => ({
          id: s.id,
          name: s.name,
          startFrame: s.startFrame,
          durationInFrames: s.durationInFrames,
          backgroundColor: s.backgroundColor,
          transitionType: s.transition?.type,
        })) : undefined,
        components: componentsRef.current ?? undefined,
        customComponents: customComponentsRef.current ?? undefined,
        projectId: latestState.projectId,
        aiModel: aiModelRef.current ?? undefined,
        currentFrame: latestState.currentFrame,
        selectedItemId: latestState.selectedItemId,
        selectedSceneId: latestState.selectedSceneId,
      };

      try {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: historyRef.current,
            compositionContext: ctx,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        if (!response.body) {
          throw new Error('No response body');
        }

        // Read SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let assistantText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events (split on double newline)
          const events = buffer.split('\n\n');
          buffer = events.pop() ?? ''; // Keep incomplete event in buffer

          for (const eventStr of events) {
            const trimmed = eventStr.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;

            const jsonStr = trimmed.slice(6); // Remove "data: " prefix
            let event: SSEEvent;
            try {
              event = JSON.parse(jsonStr) as SSEEvent;
            } catch {
              continue; // Skip malformed events
            }

            switch (event.type) {
              case 'text': {
                assistantText += event.content;
                appendToMessage(assistantMsgId, event.content);
                break;
              }

              case 'function_call': {
                const store = useCompositionStore.getState();
                for (const call of event.calls) {
                  try {
                    executeToolCall(call.name, call.args as Record<string, unknown>, store);
                    const description = `\n[Executed: ${call.name}]`;
                    assistantText += description;
                    appendToMessage(assistantMsgId, description);
                  } catch (toolErr) {
                    const errDesc = `\n[Tool error: ${call.name} - ${toolErr instanceof Error ? toolErr.message : 'unknown error'}]`;
                    assistantText += errDesc;
                    appendToMessage(assistantMsgId, errDesc);
                  }
                }
                break;
              }

              case 'composition': {
                // Load generated composition into store
                const store = useCompositionStore.getState();
                store.loadComposition(event.data as Parameters<typeof store.loadComposition>[0]);
                const desc = '\n[Generated new composition]';
                assistantText += desc;
                appendToMessage(assistantMsgId, desc);
                break;
              }

              case 'done': {
                completeMessage(assistantMsgId);
                break;
              }

              case 'error': {
                failMessage(assistantMsgId, event.message);
                break;
              }
            }
          }
        }

        // Add assistant response to history for multi-turn
        if (assistantText) {
          historyRef.current.push({
            role: 'model',
            parts: [{ text: assistantText }],
          });
        }

        // Ensure message is marked complete even if no 'done' event received
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId && msg.status === 'streaming'
              ? { ...msg, status: 'complete' as const }
              : msg
          )
        );
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to send message';
        failMessage(assistantMsgId, errorMsg);
        setError(errorMsg);
      } finally {
        setIsLoading(false);
      }

      return { userMsgId, assistantMsgId };
    },
    [addUserMessage, addAssistantMessage, appendToMessage, completeMessage, failMessage]
  );

  return {
    messages,
    isLoading,
    error,
    addUserMessage,
    addAssistantMessage,
    appendToMessage,
    completeMessage,
    failMessage,
    clearMessages,
    sendMessage,
  };
}
