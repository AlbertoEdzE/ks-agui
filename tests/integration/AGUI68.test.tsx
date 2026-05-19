/**
 * @vitest-environment jsdom
 * AGUI-68: AGUIApprovalGate renders awaiting_confirmation with draft preview content.
 * Validates the component rendering contract against the real scenario_4 backend.
 * Complements Scenario4.test.tsx which validates the protocol state machine contract.
 */
import { expect, test, describe, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { render, cleanup, waitFor, act, fireEvent } from '@testing-library/react';
import { execSync } from 'child_process';
import { AGUIProvider } from '../../src/components/AGUIProvider';
import { AGUIApprovalGate } from '../../src/components/AGUIApprovalGate';
import { useAGUIToolCalls } from '../../src/hooks/useAGUIToolCalls';
import { useAGUIMessages } from '../../src/hooks/useAGUIMessages';

const BASE = 'http://localhost:8004';

describe('AGUI-68: AGUIApprovalGate with awaiting_confirmation status', () => {
  beforeAll(async () => {
    try { execSync('./scripts/start-backend.sh 4'); } catch (_) {}
    for (let i = 0; i < 20; i++) {
      try { await fetch(`${BASE}/health`); break; } catch (_) {
        await new Promise(r => setTimeout(r, 500));
      }
    }
  });

  afterAll(() => { try { execSync('./scripts/stop-backend.sh 4'); } catch (_) {} });

  afterEach(() => { cleanup(); });

  test('AGUI-68a: approval gate renders with preview_title when status is awaiting_confirmation', async () => {
    let toolCallHook: ReturnType<typeof useAGUIToolCalls> | null = null;
    let msgHook: ReturnType<typeof useAGUIMessages> | null = null;

    const GateUI = () => {
      toolCallHook = useAGUIToolCalls();
      msgHook = useAGUIMessages();
      return (
        <div>
          {toolCallHook.toolCalls
            .filter(tc => tc.status === 'awaiting_confirmation' || tc.status === 'pending')
            .map(tc => (
              <AGUIApprovalGate
                key={tc.id}
                toolCall={tc}
                onApprove={toolCallHook!.approveToolCall}
                onReject={toolCallHook!.rejectToolCall}
              />
            ))}
        </div>
      );
    };

    const { queryByTestId, queryByText } = render(
      <AGUIProvider endpoint={`${BASE}/draft_referral`}>
        <GateUI />
      </AGUIProvider>
    );

    await waitFor(() => expect(toolCallHook).not.toBeNull());
    act(() => { msgHook!.sendMessage('refer this submission'); });

    await waitFor(
      () => expect(toolCallHook!.toolCalls.some(t => t.status === 'awaiting_confirmation')).toBe(true),
      { timeout: 10000 }
    );

    const tc = toolCallHook!.toolCalls.find(t => t.status === 'awaiting_confirmation')!;

    await waitFor(
      () => expect(queryByTestId(`agui-approval-gate-${tc.id}`)).not.toBeNull(),
      { timeout: 3000 }
    );

    // Gate renders preview_title (not the generic "Requires Approval: draft_referral")
    expect(queryByText('Create Referral — Normal Priority')).not.toBeNull();
    expect(queryByText('Requires Approval: draft_referral')).toBeNull();

    // Approve and reject buttons present
    expect(queryByText('Approve')).not.toBeNull();
    expect(queryByText('Reject')).not.toBeNull();
  });

  test('AGUI-68b: approve button forwards draft result to agent and gate disappears', async () => {
    let toolCallHook: ReturnType<typeof useAGUIToolCalls> | null = null;
    let msgHook: ReturnType<typeof useAGUIMessages> | null = null;

    const GateUI = () => {
      toolCallHook = useAGUIToolCalls();
      msgHook = useAGUIMessages();
      return (
        <div>
          {toolCallHook.toolCalls
            .filter(tc => tc.status === 'awaiting_confirmation' || tc.status === 'pending')
            .map(tc => (
              <AGUIApprovalGate
                key={tc.id}
                toolCall={tc}
                onApprove={toolCallHook!.approveToolCall}
                onReject={toolCallHook!.rejectToolCall}
              />
            ))}
        </div>
      );
    };

    const { queryByText } = render(
      <AGUIProvider endpoint={`${BASE}/draft_referral`}>
        <GateUI />
      </AGUIProvider>
    );

    await waitFor(() => expect(toolCallHook).not.toBeNull());
    act(() => { msgHook!.sendMessage('refer this submission'); });

    await waitFor(
      () => expect(toolCallHook!.toolCalls.some(t => t.status === 'awaiting_confirmation')).toBe(true),
      { timeout: 10000 }
    );

    // Click Approve — gate passes toolCall.result (draft object with draft_id)
    const approveBtn = queryByText('Approve')!;
    expect(approveBtn).not.toBeNull();
    act(() => { fireEvent.click(approveBtn); });

    // After approval, tool call transitions to approved, gate disappears
    await waitFor(
      () => expect(
        toolCallHook!.toolCalls.find(t => t.status === 'awaiting_confirmation')
      ).toBeUndefined(),
      { timeout: 5000 }
    );

    // Execution completes
    await waitFor(
      () => expect(
        toolCallHook!.toolCalls.some(t =>
          t.status === 'complete' &&
          (t.result as Record<string, unknown>)?.['referral_id']
        )
      ).toBe(true),
      { timeout: 15000 }
    );
  });

  test('AGUI-68c: pending tool call still renders generic "Requires Approval" text', async () => {
    const { getByText } = render(
      <AGUIApprovalGate
        toolCall={{ id: 'tc-1', name: 'some_tool', args: {}, status: 'pending' }}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );
    expect(getByText('Requires Approval: some_tool')).toBeDefined();
  });
});
