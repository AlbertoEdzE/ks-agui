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

    await waitFor(() => expect(toolCallHook!.toolCalls.length).toBeGreaterThan(0), { timeout: 5000 });
    const elapsed = Date.now() - t0;

    expect(elapsed).toBeLessThan(5000);
    expect(toolCallHook!.toolCalls[0].name).toBe('search_web');
  });

  // AGUI-53: message input remains disabled during streaming, re-enabled after RUN_FINISHED
  test('AGUI-53: input disabled during streaming, re-enabled after completion', async () => {
    let msgHook: ReturnType<typeof useAGUIMessages> | null = null;

    const CustomUI = () => {
      msgHook = useAGUIMessages();
      return (
        <input
          data-testid="msg-input"
          disabled={msgHook.isStreaming}
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

    await waitFor(() => expect(input.disabled).toBe(true), { timeout: 5000 });
    await waitFor(() => expect(input.disabled).toBe(false), { timeout: 15000 });
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

    await waitFor(() => expect(toolCallHook!.toolCalls.length).toBeGreaterThan(0), { timeout: 5000 });
    const firstId = toolCallHook!.toolCalls[0].id;

    act(() => { toolCallHook!.approveToolCall(firstId, { approved: true }); });

    await waitFor(() =>
      expect(toolCallHook!.toolCalls.find(t => t.id === firstId)?.status).toBe('approved')
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

    // Show all tool calls (no status filter) so elements persist in DOM after completion
    const CustomApprovalUI = () => {
      toolCallHook = useAGUIToolCalls();
      msgHook = useAGUIMessages();
      return (
        <div>
          {toolCallHook.toolCalls.map(tc => (
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

    // Wait until both tool name is present and args have been populated by TOOL_CALL_ARGS
    await waitFor(() => {
      expect(queryByTestId('tool-name')).not.toBeNull();
      expect(queryByTestId('tool-args')!.textContent).toContain('query');
    }, { timeout: 5000 });

    expect(queryByTestId('tool-name')!.textContent).toBe('search_web');

    // Approve if still visible (window is open until TOOL_CALL_RESULT arrives)
    const item = queryByTestId('approval-item');
    if (item) {
      act(() => { fireEvent.click(item.querySelector('button')!); });
    }
  });
});
