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
            id: event.callId as string,
            name: event.name as string,
            args: {},
            status: 'pending'
          }
        ]);
      },
      onToolCallArgsEvent: ({ event, partialToolCallArgs }) => {
        setToolCalls(prev => prev.map(t => 
          t.id === event.callId ? { ...t, args: partialToolCallArgs } : t
        ));
      },
      onToolCallEndEvent: () => {
        // Just finish args parsing
      },
      onToolCallResultEvent: ({ event }) => {
        setToolCalls(prev => prev.map(t => 
          t.id === event.callId ? { ...t, status: (event.result as any)?.approved ? 'approved' : 'rejected', result: event.result as any } : t
        ));
      }
    });

    return () => sub.unsubscribe();
  }, [agent]);

  const approveToolCall = useCallback((id: string, result?: any) => {
    if (!agent) return;
    
    setToolCalls(prev => prev.map(t => 
      t.id === id ? { ...t, status: 'approved', result } : t
    ));

    agent.addMessage({
      id: crypto.randomUUID(),
      role: 'user', // Action results in copilotkit are typically pushed this way
      type: 'ActionExecutionResult',
      actionExecutionId: id,
      result: JSON.stringify(result || { approved: true })
    } as any);
    
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
      content: 'Rejected by user',
      toolCallId: id,
    } as any);
    
    agent.runAgent();
  }, [agent]);

  return { toolCalls, approveToolCall, rejectToolCall };
}
