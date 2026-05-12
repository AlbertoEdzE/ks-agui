import * as React from 'react';
import { useRef, useEffect, useState } from 'react';
import { useAGUIMessages } from '../hooks/useAGUIMessages';
import { useAGUIToolCalls } from '../hooks/useAGUIToolCalls';
import { AGUIMessage as DefaultAGUIMessage } from './AGUIMessage';
import { AGUIToolCallDisplay as DefaultAGUIToolCallDisplay } from './AGUIToolCallDisplay';
import { AGUIApprovalGate } from './AGUIApprovalGate';
import { AGUIChatProps, AGUIMessage, AGUIToolCall } from '../types';

/**
 * Main chat interface component for AG-UI.
 * Connects to hooks and renders messages, tool calls, and an input area.
 */
export function AGUIChat({
  placeholder = 'Type a message...',
  className = '',
  renderMessage,
  renderToolCall
}: AGUIChatProps) {
  const { messages, isStreaming, sendMessage } = useAGUIMessages();
  const { toolCalls, approveToolCall, rejectToolCall } = useAGUIToolCalls();
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // AGUI-31: Input disabled while any tool call has status pending
  const hasPendingToolCall = toolCalls.some(t => t.status === 'pending');
  
  // AGUI-30: Input disabled while isStreaming is true
  const inputDisabled = isStreaming || hasPendingToolCall;

  // AGUI-29: Scrolls to bottom on each new message token
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages, toolCalls, isStreaming]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim() && !inputDisabled) {
      sendMessage(inputText);
      setInputText('');
    }
  };

  return (
    <div className={`agui-chat-container ${className}`} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div 
        className="agui-messages-list" 
        style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}
      >
        {messages.map((msg: AGUIMessage) => {
          // Check if there are tool calls linked to this message? 
          // CopilotKit usually associates tool calls. In our headless setup, tool calls are a separate array.
          // For simplicity, we just render messages, then tool calls, or interleave if we have timestamps.
          // Actually, we'll render messages first, and tool calls after. Wait, they should be ordered.
          // Since tool calls don't have createdAt in our mock AGUIToolCall type, we just render them below messages.
          // Actually, we should just map messages.
          return (
            <div key={msg.id}>
              {renderMessage ? renderMessage(msg) : <DefaultAGUIMessage message={msg} />}
            </div>
          );
        })}

        {toolCalls.map((tc: AGUIToolCall) => (
          <div key={tc.id}>
            {tc.status === 'pending' ? (
              <AGUIApprovalGate 
                toolCall={tc} 
                onApprove={approveToolCall} 
                onReject={rejectToolCall} 
              />
            ) : (
              renderToolCall ? renderToolCall(tc) : <DefaultAGUIToolCallDisplay toolCall={tc} />
            )}
          </div>
        ))}
        
        {/* AGUI-26: Streaming indicator */}
        {isStreaming && (
          <div className="agui-streaming-indicator" style={{ fontStyle: 'italic', color: '#888' }}>
            Agent is typing...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="agui-input-area" style={{ padding: '16px', borderTop: '1px solid #ccc' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={inputDisabled}
            placeholder={placeholder}
            className="agui-text-input"
            style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          <button 
            type="submit" 
            disabled={inputDisabled || !inputText.trim()}
            className="agui-send-button"
            style={{ padding: '8px 16px', borderRadius: '4px', background: '#007bff', color: '#fff', border: 'none', cursor: inputDisabled ? 'not-allowed' : 'pointer' }}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
