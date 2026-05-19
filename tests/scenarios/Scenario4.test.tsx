/**
 * @vitest-environment jsdom
 * Scenario 4: Component 25 Draft->Confirm->Execute
 * Uses headless hooks only — AGUIChat and AGUIApprovalGate are deliberately NOT
 * imported here to validate that the protocol state machine is correct independent
 * of the default components.
 */
import { expect, test, describe, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { render, cleanup, waitFor, act } from '@testing-library/react';
import { execSync } from 'child_process';
import { AGUIProvider } from '../../src/components/AGUIProvider';
import { useAGUIToolCalls } from '../../src/hooks/useAGUIToolCalls';
import { useAGUIMessages } from '../../src/hooks/useAGUIMessages';
import { AGUIError } from '../../src/types';

const BASE = 'http://localhost:8004';

describe('Scenario 4: Draft->Confirm->Execute (headless hooks)', () => {
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

  // -------------------------------------------------------------------------
  // KSAG-015a: Draft arrives with requires_confirmation
  // -------------------------------------------------------------------------
  test('KSAG-015a: draft_referral sets status to awaiting_confirmation with preview data', async () => {
    let toolCallHook: ReturnType<typeof useAGUIToolCalls> | null = null;
    let msgHook: ReturnType<typeof useAGUIMessages> | null = null;

    const Spy = () => {
      toolCallHook = useAGUIToolCalls();
      msgHook = useAGUIMessages();
      return null;
    };

    render(
      <AGUIProvider endpoint={`${BASE}/draft_referral`}>
        <Spy />
      </AGUIProvider>
    );

    await waitFor(() => expect(toolCallHook).not.toBeNull());
    act(() => { msgHook!.sendMessage('refer this submission'); });

    await waitFor(
      () => expect(toolCallHook!.toolCalls.some(t => t.status === 'awaiting_confirmation')).toBe(true),
      { timeout: 10000 }
    );

    const tc = toolCallHook!.toolCalls.find(t => t.status === 'awaiting_confirmation')!;
    const result = tc.result as Record<string, unknown>;
    expect(result['preview_title']).toBe('Create Referral — Normal Priority');
    expect(result['requires_confirmation']).toBe(true);
    expect(typeof result['draft_id']).toBe('string');
  });

  // -------------------------------------------------------------------------
  // KSAG-015b: Approval triggers execution
  // -------------------------------------------------------------------------
  test('KSAG-015b: approveToolCall triggers execute_draft_action and reaches complete', async () => {
    let toolCallHook: ReturnType<typeof useAGUIToolCalls> | null = null;
    let msgHook: ReturnType<typeof useAGUIMessages> | null = null;

    const Spy = () => {
      toolCallHook = useAGUIToolCalls();
      msgHook = useAGUIMessages();
      return null;
    };

    render(
      <AGUIProvider endpoint={`${BASE}/draft_referral`}>
        <Spy />
      </AGUIProvider>
    );

    await waitFor(() => expect(toolCallHook).not.toBeNull());
    act(() => { msgHook!.sendMessage('refer this submission'); });

    await waitFor(
      () => expect(toolCallHook!.toolCalls.some(t => t.status === 'awaiting_confirmation')).toBe(true),
      { timeout: 10000 }
    );

    const tc = toolCallHook!.toolCalls.find(t => t.status === 'awaiting_confirmation')!;
    act(() => { toolCallHook!.approveToolCall(tc.id, tc.result); });

    await waitFor(
      () => {
        const res = toolCallHook!.toolCalls.find(
          t => t.status === 'complete' && (t.result as Record<string, unknown>)?.['referral_id']
        );
        return expect(res).toBeDefined();
      },
      { timeout: 15000 }
    );

    await waitFor(
      () => expect(msgHook!.messages.some(m => m.role === 'assistant' && m.status === 'complete')).toBe(true),
      { timeout: 5000 }
    );
  });

  // -------------------------------------------------------------------------
  // KSAG-015c: Rejection sends cancelled signal
  // -------------------------------------------------------------------------
  test('KSAG-015c: rejectToolCall triggers cancellation message from agent', async () => {
    let toolCallHook: ReturnType<typeof useAGUIToolCalls> | null = null;
    let msgHook: ReturnType<typeof useAGUIMessages> | null = null;

    const Spy = () => {
      toolCallHook = useAGUIToolCalls();
      msgHook = useAGUIMessages();
      return null;
    };

    render(
      <AGUIProvider endpoint={`${BASE}/draft_cancelled`}>
        <Spy />
      </AGUIProvider>
    );

    await waitFor(() => expect(toolCallHook).not.toBeNull());
    act(() => { msgHook!.sendMessage('refer this submission'); });

    await waitFor(
      () => expect(toolCallHook!.toolCalls.length).toBeGreaterThan(0),
      { timeout: 10000 }
    );

    const tc = toolCallHook!.toolCalls[0];
    act(() => { toolCallHook!.rejectToolCall(tc.id); });

    await waitFor(
      () => expect(msgHook!.messages.some(m => m.content.includes('cancelled'))).toBe(true),
      { timeout: 15000 }
    );
  });

  // -------------------------------------------------------------------------
  // KSAG-015d: Expired draft returns RUN_ERROR
  // -------------------------------------------------------------------------
  test('KSAG-015d: draft_expired endpoint fires onError with RUN_ERROR', async () => {
    const onError = vi.fn();
    let msgHook: ReturnType<typeof useAGUIMessages> | null = null;

    const Spy = () => {
      msgHook = useAGUIMessages();
      return null;
    };

    render(
      <AGUIProvider endpoint={`${BASE}/draft_expired`} onError={onError}>
        <Spy />
      </AGUIProvider>
    );

    await waitFor(() => expect(msgHook).not.toBeNull());
    act(() => { msgHook!.sendMessage('refer'); });

    await waitFor(
      () => expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'RUN_ERROR' } as Partial<AGUIError>)
      ),
      { timeout: 15000 }
    );
  });

  // -------------------------------------------------------------------------
  // KSAG-016a: write_disabled — no approval gate, tool call completes
  // -------------------------------------------------------------------------
  test('KSAG-016a: write_disabled produces complete status (no awaiting_confirmation)', async () => {
    let toolCallHook: ReturnType<typeof useAGUIToolCalls> | null = null;
    let msgHook: ReturnType<typeof useAGUIMessages> | null = null;

    const Spy = () => {
      toolCallHook = useAGUIToolCalls();
      msgHook = useAGUIMessages();
      return null;
    };

    render(
      <AGUIProvider endpoint={`${BASE}/write_disabled`}>
        <Spy />
      </AGUIProvider>
    );

    await waitFor(() => expect(toolCallHook).not.toBeNull());
    act(() => { msgHook!.sendMessage('refer'); });

    await waitFor(
      () => expect(toolCallHook!.toolCalls.some(t => t.status === 'complete')).toBe(true),
      { timeout: 10000 }
    );

    expect(toolCallHook!.toolCalls.every(t => t.status !== 'awaiting_confirmation')).toBe(true);
  });

  // -------------------------------------------------------------------------
  // KSAG-016b: domain_api_failure — execution result has success: false
  // -------------------------------------------------------------------------
  test('KSAG-016b: domain_api_failure produces complete tool call with success: false', async () => {
    let toolCallHook: ReturnType<typeof useAGUIToolCalls> | null = null;
    let msgHook: ReturnType<typeof useAGUIMessages> | null = null;

    const Spy = () => {
      toolCallHook = useAGUIToolCalls();
      msgHook = useAGUIMessages();
      return null;
    };

    render(
      <AGUIProvider endpoint={`${BASE}/domain_api_failure`}>
        <Spy />
      </AGUIProvider>
    );

    await waitFor(() => expect(toolCallHook).not.toBeNull());
    act(() => { msgHook!.sendMessage('refer this submission'); });

    await waitFor(
      () => expect(toolCallHook!.toolCalls.some(t => t.status === 'awaiting_confirmation')).toBe(true),
      { timeout: 10000 }
    );

    const tc = toolCallHook!.toolCalls.find(t => t.status === 'awaiting_confirmation')!;
    act(() => { toolCallHook!.approveToolCall(tc.id, tc.result); });

    await waitFor(
      () => {
        const failed = toolCallHook!.toolCalls.find(
          t => t.status === 'complete' &&
               (t.result as Record<string, unknown>)?.['success'] === false
        );
        return expect(failed).toBeDefined();
      },
      { timeout: 15000 }
    );
  });

  // -------------------------------------------------------------------------
  // KSAG-016c: concurrent execute — second approval on executed draft returns RUN_ERROR
  // -------------------------------------------------------------------------
  test('KSAG-016c: second approveToolCall on executed draft triggers RUN_ERROR', async () => {
    const onError = vi.fn();
    let toolCallHook: ReturnType<typeof useAGUIToolCalls> | null = null;
    let msgHook: ReturnType<typeof useAGUIMessages> | null = null;

    const Spy = () => {
      toolCallHook = useAGUIToolCalls();
      msgHook = useAGUIMessages();
      return null;
    };

    render(
      <AGUIProvider endpoint={`${BASE}/draft_referral`} onError={onError}>
        <Spy />
      </AGUIProvider>
    );

    await waitFor(() => expect(toolCallHook).not.toBeNull());
    act(() => { msgHook!.sendMessage('refer this submission'); });

    await waitFor(
      () => expect(toolCallHook!.toolCalls.some(t => t.status === 'awaiting_confirmation')).toBe(true),
      { timeout: 10000 }
    );

    const tc = toolCallHook!.toolCalls.find(t => t.status === 'awaiting_confirmation')!;
    act(() => { toolCallHook!.approveToolCall(tc.id, tc.result); });

    // Wait for first execution to complete
    await waitFor(
      () => expect(
        toolCallHook!.toolCalls.some(t => t.status === 'complete' &&
          (t.result as Record<string, unknown>)?.['referral_id'])
      ).toBe(true),
      { timeout: 15000 }
    );

    // Second approval on the same draft — backend returns RUN_ERROR (already executed)
    act(() => { toolCallHook!.approveToolCall(tc.id, tc.result); });

    await waitFor(
      () => expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'RUN_ERROR' } as Partial<AGUIError>)
      ),
      { timeout: 15000 }
    );
  });
});
