import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { openLocalApiWebSocket } from '@/shared/lib/localApiTransport';
import { useBrainstormStore } from '../stores/useBrainstormStore';
import { brainstormKeys } from './useBrainstormSessions';
import type { BrainstormStreamEvent } from 'shared/types';

export function useBrainstormSend() {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const store = useBrainstormStore();

  const send = useCallback(
    async (sessionId: string, message: string) => {
      if (store.isStreaming) return;

      // Close any stale WebSocket from a prior send
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      // Reset accumulated text, then enable streaming
      store.resetStreaming();
      store.setIsStreaming(true);

      try {
        const ws = await openLocalApiWebSocket(
          `/api/brainstorm/sessions/${sessionId}/stream/ws`
        );
        wsRef.current = ws;

        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              message,
              budget_tokens: store.thinkingBudget,
            })
          );
        };

        ws.onmessage = (event) => {
          try {
            const data: BrainstormStreamEvent = JSON.parse(event.data);
            if (data.type === 'TextDelta') {
              store.appendStreamingText(data.data.text);
            } else if (data.type === 'ThinkingDelta') {
              store.appendStreamingThinking(data.data.thinking);
            } else if (data.type === 'MessageComplete') {
              // Invalidate queries to refresh message list
              queryClient.invalidateQueries({
                queryKey: brainstormKeys.session(sessionId),
              });
              store.resetStreaming();
            } else if (data.type === 'Error') {
              console.error('Brainstorm stream error:', data.data.error);
              store.resetStreaming();
            }
          } catch (e) {
            console.error('Failed to parse brainstorm event:', e);
          }
        };

        ws.onerror = () => {
          store.resetStreaming();
        };

        ws.onclose = () => {
          wsRef.current = null;
          if (store.isStreaming) {
            store.resetStreaming();
          }
        };
      } catch (e) {
        console.error('Failed to open brainstorm WebSocket:', e);
        store.resetStreaming();
      }
    },
    [store, queryClient]
  );

  const cancel = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    store.resetStreaming();
  }, [store]);

  return { send, cancel };
}
