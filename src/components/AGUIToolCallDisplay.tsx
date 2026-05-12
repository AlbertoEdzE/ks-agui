import * as React from 'react';
import { AGUIToolCall } from '../types';

/**
 * Props for the AGUIToolCallDisplay component.
 */
export interface AGUIToolCallDisplayProps {
  toolCall: AGUIToolCall;
}

/**
 * Default renderer for a single tool call in AGUIChat.
 * Renders the tool call name, parsed args, status, and result.
 * 
 * @param props - Contains the AGUIToolCall to render.
 */
export function AGUIToolCallDisplay({ toolCall }: AGUIToolCallDisplayProps) {
  return (
    <div 
      data-testid={`agui-toolcall-${toolCall.id}`}
      style={{
        border: '1px solid #ccc',
        padding: '8px 12px',
        margin: '4px 0',
        borderRadius: '8px',
        backgroundColor: '#fafafa',
        fontFamily: 'monospace',
        fontSize: '0.9em'
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
        ⚙️ Tool Call: {toolCall.name}
      </div>
      <div style={{ marginBottom: '4px' }}>
        <strong>Status:</strong> {toolCall.status}
      </div>
      {toolCall.args && Object.keys(toolCall.args).length > 0 && (
        <div style={{ marginBottom: '4px' }}>
          <strong>Args:</strong>
          <pre style={{ margin: '4px 0', padding: '4px', background: '#eee', borderRadius: '4px' }}>
            {JSON.stringify(toolCall.args, null, 2)}
          </pre>
        </div>
      )}
      {toolCall.result && (
        <div>
          <strong>Result:</strong>
          <pre style={{ margin: '4px 0', padding: '4px', background: '#eee', borderRadius: '4px' }}>
            {JSON.stringify(toolCall.result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
