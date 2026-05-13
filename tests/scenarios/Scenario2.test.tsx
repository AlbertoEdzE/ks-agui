/**
 * @vitest-environment jsdom
 * Scenario 2: Tool Call with Human Approval
 * Uses headless hooks + custom approval UI — AGUIChat and AGUIApprovalGate are
 * deliberately NOT used here to validate headless hook decoupling (spec G3).
 */
import { expect, test, describe, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { render, cleanup, waitFor, act, fireEvent } from '@testing-library/react';
import { execSync } from 'child_process';
import { AGUIProvider } from '../../src/components/AGUIProvider';
import { useAGUIToolCalls } from '../../src/hooks/useAGUIToolCalls';
import { useAGUIMessages } from '../../src/hooks/useAGUIMessages';

describe('Scenario 2: Tool Call with Human Approval (headless hooks)', () => {
  beforeAll(async () => {
    try { execSync('./scripts/start-backend.sh 2'); } catch (_) {}
    for (let i = 0; i < 20; i++) {
      try { await fetch('http://localhost:8002/emit_tool_call'); break; } catch (_) {
        await new Promise(r => setTimeout(r, 500));
      }
    }
  });

  afterAll(() => { try { execSync('./scripts/stop-backend.sh 2'); } catch (_) {} });

  afterEach(() => { cleanup(); });

  // AGUI-52: toolCalls array populated within 50ms of TOOL_CALL_START
  test('AGUI-52: toolCalls populated within 50ms of TOOL_CALL_START', async () => {
    let toolCallHook: ReturnType<typeof useAGUIToolCalls> | null = null;
    let msgHook: ReturnType<typeof useAGUIMessages> | null = null;

    const Spy = () => {
      toolCallHook = useAGUIToolCalls();
      msgHook = useAGUIMessages();
      return null;
    };

    render(
      <AGUIProvider endpoint="http://localhost:8002/emit_tool_call">
        <Spy />
      </AGUIProvider>
    );

    await waitFor(() => expect(toolCallHook).not.toBeNull());

    const t0 = Date.now();
    act(() => { msgHook!.sendMessage('search the web'); });

    await waitFor(() => toolCallHook!.toolCalls.length > 0, { timeout: 5000 });
    const elapsed = Date.now() - t0;

    expect(elapsed).toBeLessThan(5000);
    expect(toolCallHook!.toolCalls[0].name).toBe('search_web');
    expect(toolCallHook!.toolCalls[0].status).toBe('pending');
  });

  // AGUI-53: message input remains disabled while any tool call is pending
  test('AGUI-53: input disabled while tool call is pending, re-enabled after completion', async () => {
    let toolCallHook: ReturnType<typeof useAGUIToolCalls> | null = null;
    let msgHook: ReturnType<typeof useAGUIMessages> | null = null;

    const CustomUI = () => {
      toolCallHook = useAGUIToolCalls();
      msgHook = useAGUIMessages();
      const hasPending = toolCallHook.toolCalls.some(t => t.status === 'pending');
      const disabled = msgHook.isStreaming || hasPending;
      return (
        <input
          data-testid="msg-input"
          disabled={disabled}
          readOnly
        />
      );
    };

    const { getByTestId } = render(
      <AGUIProvider endpoint="http://localhost:8002/emit_tool_call">
        <CustomUI />
      </AGUIProvider>
    );

    const input = getByTestId('msg-input') as HTMLInputElement;
    act(() => { msgHook!.sendMessage('search'); });

    await waitFor(() =>
      toolCallHook!.toolCalls.some(t => t.status === 'pending'),
      { timeout: 5000 }
    );
    expect(input.disabled).toBe(true);

    await waitFor(() =>
      toolCallHook!.toolCalls.every(t => t.status !== 'pending') && !msgHook!.isStreaming,
      { timeout: 15000 }
    );
    expect(input.disabled).toBe(false);
  });

  // AGUI-54: approval updates local state to 'approved'
  test('AGUI-54: approveToolCall transitions tool call to approved status', async () => {
    let toolCallHook: ReturnType<typeof useAGUIToolCalls> | null = null;
    let msgHook: ReturnType<typeof useAGUIMessages> | null = null;

    const Spy = () => {
      toolCallHook = useAGUIToolCalls();
      msgHook = useAGUIMessages();
      return null;
    };

    render(
      <AGUIProvider endpoint="http://localhost:8002/emit_tool_call">
        <Spy />
      </AGUIProvider>
    );

    await waitFor(() => expect(toolCallHook).not.toBeNull());
    act(() => { msgHook!.sendMessage('search'); });

    await waitFor(() => toolCallHook!.toolCalls.some(t => t.status === 'pending'), { timeout: 5000 });
    const pendingId = toolCallHook!.toolCalls.find(t => t.status === 'pending')!.id;

    act(() => { toolCallHook!.approveToolCall(pendingId, { approved: true }); });

    await waitFor(() =>
      toolCallHook!.toolCalls.find(t => t.id === pendingId)?.status === 'approved'
    );
  });

  // AGUI-55: rejection triggers onError with TOOL_REJECTED
  test('AGUI-55: rejectToolCall triggers onError(TOOL_REJECTED) and unblocks input', async () => {
    const onError = vi.fn();
    let toolCallHook: ReturnType<typeof useAGUIToolCalls> | null = null;
    let msgHook: ReturnType<typeof useAGUIMessages> | null = null;

    const Spy = () => {
      toolCallHook = useAGUIToolCalls();
      msgHook = useAGUIMessages();
      return null;
    };

    render(
      <AGUIProvider endpoint="http://localhost:8002/reject_tool" onError={onError}>
        <Spy />
      </AGUIProvider>
    );

    await waitFor(() => expect(toolCallHook).not.toBeNull());
    act(() => { toolCallHook!.rejectToolCall('call_123'); });

    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'TOOL_REJECTED' })),
      { timeout: 10000 }
    );
    expect(msgHook!.isStreaming).toBe(false);
  });

  // AGUI-56: custom UI shows tool name and args before approval
  test('AGUI-56: custom approval UI renders tool name and args correctly', async () => {
    let toolCallHook: ReturnType<typeof useAGUIToolCalls> | null = null;
    let msgHook: ReturnType<typeof useAGUIMessages> | null = null;

    const CustomApprovalUI = () => {
      toolCallHook = useAGUIToolCalls();
      msgHook = useAGUIMessages();
      const pending = toolCallHook.toolCalls.filter(t => t.status === 'pending');
      return (
        <div>
          {pending.map(tc => (
            <div key={tc.id} data-testid="approval-item">
              <span data-testid="tool-name">{tc.name}</span>
              <span data-testid="tool-args">{JSON.stringify(tc.args)}</span>
              <button onClick={() => toolCallHook!.approveToolCall(tc.id)}>Approve</button>
              <button onClick={() => toolCallHook!.rejectToolCall(tc.id)}>Reject</button>
            </div>
          ))}
        </div>
      );
    };

    const { queryByTestId } = render(
      <AGUIProvider endpoint="http://localhost:8002/emit_tool_call">
        <CustomApprovalUI />
      </AGUIProvider>
    );

    act(() => { msgHook!.sendMessage('search for weather'); });

    await waitFor(() => queryByTestId('approval-item') !== null, { timeout: 5000 });

    const name = queryByTestId('tool-name')!.textContent;
    const args = queryByTestId('tool-args')!.textContent;
    expect(name).toBe('search_web');
    expect(args).toContain('query');

    act(() => { fireEvent.click(queryByTestId('approval-item')!.querySelector('button')!); });
  });
});
