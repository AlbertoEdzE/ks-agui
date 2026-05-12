import * as React from 'react';
import { AGUIMessage as AGUIMessageType } from '../types';

/**
 * Props for the AGUIMessage component.
 */
export interface AGUIMessageProps {
  message: AGUIMessageType;
}

/**
 * Default renderer for a single message in AGUIChat.
 * Renders the content of a single AGUIMessage based on its role ('user'/'assistant'),
 * status ('streaming'/'complete'), and content.
 * 
 * @param props - Contains the AGUIMessage to render
 */
export function AGUIMessage({ message }: AGUIMessageProps) {
  const isUser = message.role === 'user';
  
  return (
    <div 
      data-testid={`agui-message-${message.id}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '8px 12px',
        margin: '4px 0',
        borderRadius: '8px',
        backgroundColor: isUser ? '#e0f7fa' : '#f5f5f5',
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        maxWidth: '80%'
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '0.85em', color: '#555' }}>
        {isUser ? 'User' : 'Assistant'}
      </div>
      <div>
        {message.content}
        {message.status === 'streaming' && <span style={{ opacity: 0.6 }}>...</span>}
      </div>
    </div>
  );
}
