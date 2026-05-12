/**
 * @vitest-environment jsdom
 */
import { expect, test, describe, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { AGUIApprovalGate } from '../../src/components/AGUIApprovalGate';
import { AGUIToolCall } from '../../src/types';

describe('AGUI-25 Component Integration', () => {
  afterEach(() => {
    cleanup();
  });

  test('AGUIApprovalGate renders correctly and fires callbacks', () => {
    const pendingCall: AGUIToolCall = {
      id: 'call-2',
      name: 'executePayment',
      args: { amount: 100 },
      status: 'pending'
    };

    const handleApprove = vi.fn();
    const handleReject = vi.fn();

    const { getByText, rerender, container } = render(
      <AGUIApprovalGate 
        toolCall={pendingCall} 
        onApprove={handleApprove} 
        onReject={handleReject} 
      />
    );
    
    expect(getByText('Requires Approval: executePayment')).toBeDefined();
    
    const approveBtn = getByText('Approve');
    fireEvent.click(approveBtn);
    expect(handleApprove).toHaveBeenCalledWith('call-2', { approved: true });

    const rejectBtn = getByText('Reject');
    fireEvent.click(rejectBtn);
    expect(handleReject).toHaveBeenCalledWith('call-2');

    // Should return null if status is not pending
    const approvedCall: AGUIToolCall = {
      ...pendingCall,
      status: 'approved'
    };

    rerender(
      <AGUIApprovalGate 
        toolCall={approvedCall} 
        onApprove={handleApprove} 
        onReject={handleReject} 
      />
    );
    expect(container.firstChild).toBeNull();
  });
});
