import { AGUIToolCall } from '../types';

/**
 * Props for the AGUIApprovalGate component.
 */
export interface AGUIApprovalGateProps {
  toolCall: AGUIToolCall;
  onApprove: (id: string, result?: any) => void;
  onReject: (id: string) => void;
}

/**
 * Default human-in-the-loop approval UI for a pending tool call.
 * Renders approve/reject controls for a tool call.
 * 
 * @param props - Contains the AGUIToolCall to render, and callback functions.
 */
export function AGUIApprovalGate({ toolCall, onApprove, onReject }: AGUIApprovalGateProps) {
  if (toolCall.status !== 'pending') {
    return null;
  }

  return (
    <div 
      data-testid={`agui-approval-gate-${toolCall.id}`}
      style={{
        border: '1px solid #ffcc00',
        padding: '12px',
        margin: '4px 0',
        borderRadius: '8px',
        backgroundColor: '#fffbeb',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}
    >
      <div style={{ fontWeight: 'bold', color: '#b45309' }}>
        Requires Approval: {toolCall.name}
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button 
          onClick={() => onApprove(toolCall.id, { approved: true })}
          style={{
            padding: '4px 12px',
            backgroundColor: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Approve
        </button>
        <button 
          onClick={() => onReject(toolCall.id)}
          style={{
            padding: '4px 12px',
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Reject
        </button>
      </div>
    </div>
  );
}
