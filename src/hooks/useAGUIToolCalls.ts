import { useState, useEffect, useCallback } from 'react';
import { useAGUIConnection } from './useAGUIConnection';
import { AGUIToolCall } from '../types';

export function useAGUIToolCalls() {
  const agent = useAGUIConnection();
  const [toolCalls, setToolCalls] = useState<AGUIToolCall[]>([]);

  useEffect(() => {
    if (!agent) return;

    const sub = agent.subscribe({
      onToolCallStartEvent: ({ event }) => {
        setToolCalls(prev => [
          ...prev,
          {
            id: event.toolCallId,
            name: event.toolCallName,
            args: {},
            status: 'pending'
          }
        ]);
      },
      onToolCallArgsEvent: ({ event, partialToolCallArgs }) => {
        setToolCalls(prev => prev.map(t =>
          t.id === event.toolCallId ? { ...t, args: partialToolCallArgs } : t
        ));
      },
      onToolCallEndEvent: ({ event, toolCallArgs }) => {
        setToolCalls(prev => prev.map(t =>
          t.id === event.toolCallId ? { ...t, args: toolCallArgs ?? t.args, status: 'executing' } : t
        ));
      },
      onToolCallResultEvent: ({ event }) => {
        setToolCalls(prev => prev.map(t =>
          t.id === event.toolCallId ? { ...t, status: 'complete', result: event.content } : t
        ));
      }
    });

    return () => sub.unsubscribe();
  }, [agent]);

  const approveToolCall = useCallback((id: string, result?: unknown) => {
    if (!agent) return;

    setToolCalls(prev => prev.map(t =>
      t.id === id ? { ...t, status: 'approved', result } : t
    ));

    agent.addMessage({
      id: crypto.randomUUID(),
      role: 'tool',
      toolCallId: id,
      content: JSON.stringify(result ?? { approved: true })
    } as Parameters<typeof agent.addMessage>[0]);

    agent.runAgent();
  }, [agent]);

  const rejectToolCall = useCallback((id: string) => {
    if (!agent) return;

    setToolCalls(prev => prev.map(t =>
      t.id === id ? { ...t, status: 'rejected' } : t
    ));

    agent.addMessage({
      id: crypto.randomUUID(),
      role: 'tool',
      toolCallId: id,
      content: JSON.stringify({ approved: false })
    } as Parameters<typeof agent.addMessage>[0]);

    agent.runAgent();
  }, [agent]);

  return { toolCalls, approveToolCall, rejectToolCall };
}
