import { useState, useEffect, useCallback } from 'react';
import { useAGUIConnection } from './useAGUIConnection';
import { AGUIMessage } from '../types';

export function useAGUIMessages() {
  const agent = useAGUIConnection();
  const [messages, setMessages] = useState<AGUIMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    if (!agent) return;

    const sub = agent.subscribe({
      onRunStartedEvent: () => {
        setIsStreaming(true);
      },
      onRunFinishedEvent: () => {
        setIsStreaming(false);
      },
      onTextMessageStartEvent: ({ event }) => {
        setMessages(prev => [
          ...prev, 
          {
            id: event.messageId,
            role: event.role === 'user' ? 'user' : 'assistant',
            content: '',
            status: 'streaming',
            createdAt: Date.now()
          }
        ]);
      },
      onTextMessageContentEvent: ({ event, textMessageBuffer }) => {
        setMessages(prev => prev.map(m => 
          m.id === event.messageId ? { ...m, content: textMessageBuffer } : m
        ));
      },
      onTextMessageEndEvent: ({ event, textMessageBuffer }) => {
        setMessages(prev => prev.map(m => 
          m.id === event.messageId ? { ...m, content: textMessageBuffer, status: 'complete' } : m
        ));
      },
      onMessagesSnapshotEvent: ({ event }) => {
        setMessages(event.messages.map((m: any) => ({
          id: m.id,
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content?.map((c: any) => c.text).join('') || '',
          status: 'complete',
          createdAt: m.createdAt ? new Date(m.createdAt).getTime() : Date.now()
        })));
      },
      onRunErrorEvent: () => {
        setIsStreaming(false);
      },
      onCustomEvent: () => {
        // AGUI-45: Silently ignored
      },
      onRawEvent: () => {
        // AGUI-46: Silently ignored
      },
      onStepStartedEvent: () => {
        // AGUI-47: Silently ignored
      }
    });

    return () => sub.unsubscribe();
  }, [agent]);

  const sendMessage = useCallback((content: string) => {
    if (!agent) return;
    
    const userMessage: AGUIMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      status: 'complete',
      createdAt: Date.now()
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    // Wait, @ag-ui/core Message has id, role, content array.
    agent.addMessage({ id: userMessage.id, role: 'user', content: [{ type: 'text', text: content }] } as any);
    setIsStreaming(true);
    agent.runAgent().finally(() => setIsStreaming(false));
  }, [agent]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, isStreaming, sendMessage, clearMessages };
}
