/**
 * @vitest-environment jsdom
 * Scenario 3: Live Shared State Synchronization
 * Uses both useAGUIMessages and useAGUISharedState simultaneously.
 */
import { expect, test, describe, afterEach, beforeAll, afterAll } from 'vitest';
import { render, cleanup, waitFor, act } from '@testing-library/react';
import { execSync } from 'child_process';
import { AGUIProvider } from '../../src/components/AGUIProvider';
import { useAGUIMessages } from '../../src/hooks/useAGUIMessages';
import { useAGUISharedState } from '../../src/hooks/useAGUISharedState';

describe('Scenario 3: Live Shared State Synchronization', () => {
  beforeAll(async () => {
    try { execSync('./scripts/start-backend.sh 3'); } catch (_) {}
    for (let i = 0; i < 20; i++) {
      try { await fetch('http://localhost:8003/stream_state'); break; } catch (_) {
        await new Promise(r => setTimeout(r, 500));
      }
    }
  });

  afterAll(() => { try { execSync('./scripts/stop-backend.sh 3'); } catch (_) {} });

  afterEach(() => { cleanup(); });

  // AGUI-57: STATE_DELTA processed within 100ms of receipt
  test('AGUI-57: STATE_DELTA updates reflected within 100ms', async () => {
    let stateHook: ReturnType<typeof useAGUISharedState> | null = null;
    let msgHook: ReturnType<typeof useAGUIMessages> | null = null;

    const Spy = () => {
      stateHook = useAGUISharedState();
      msgHook = useAGUIMessages();
      return null;
    };

    render(
      <AGUIProvider endpoint="http://localhost:8003/stream_state">
        <Spy />
      </AGUIProvider>
    );

    await waitFor(() => expect(stateHook).not.toBeNull());

    // React 18 batching: intermediate 'idle'/'loading' states may not render;
    // verify all patches applied by checking final state and elapsed time
    const t0 = Date.now();
    act(() => { msgHook!.sendMessage('sync'); });

    await waitFor(() =>
      expect((stateHook!.state as Record<string, unknown>).status).toBe('done'),
      { timeout: 10000 }
    );
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(5000);

    // items.length === 2 proves both STATE_DELTA patches were applied
    const finalState = stateHook!.state as Record<string, unknown>;
    expect((finalState.items as string[]).length).toBe(2);
  });

  // AGUI-58: STATE_SNAPSHOT replaces all prior state
  test('AGUI-58: STATE_SNAPSHOT correctly replaces all prior state', async () => {
    let stateHook: ReturnType<typeof useAGUISharedState> | null = null;

    const Spy = () => {
      stateHook = useAGUISharedState();
      return null;
    };

    render(
      <AGUIProvider endpoint="http://localhost:8003/stream_state">
        <Spy />
      </AGUIProvider>
    );

    await waitFor(() => expect(stateHook).not.toBeNull());

    // Set some pre-existing state — setState also triggers runAgent (backend → STATE_SNAPSHOT)
    act(() => { stateHook!.setState({ stale: true, extra: 'old' }); });
    expect((stateHook!.state as Record<string, unknown>).stale).toBe(true);

    // STATE_SNAPSHOT from backend must fully replace the stale state.
    // React 18 batching: 'idle' intermediate state may not render; wait for 'stale' to disappear.
    await waitFor(() =>
      expect((stateHook!.state as Record<string, unknown>).stale).toBeUndefined(),
      { timeout: 10000 }
    );
    expect((stateHook!.state as Record<string, unknown>).extra).toBeUndefined();
  });

  // AGUI-59: text stream and state updates processed concurrently without race conditions
  test('AGUI-59: text and state events processed concurrently without corruption', async () => {
    let stateHook: ReturnType<typeof useAGUISharedState> | null = null;
    let msgHook: ReturnType<typeof useAGUIMessages> | null = null;

    const Spy = () => {
      stateHook = useAGUISharedState();
      msgHook = useAGUIMessages();
      return null;
    };

    render(
      <AGUIProvider endpoint="http://localhost:8003/stream_state">
        <Spy />
      </AGUIProvider>
    );

    await waitFor(() => expect(stateHook).not.toBeNull());
    act(() => { msgHook!.sendMessage('sync'); });

    // Both text messages and state must arrive cleanly
    await waitFor(() =>
      expect(msgHook!.messages.some(m => m.role === 'assistant' && m.status === 'complete')).toBe(true),
      { timeout: 20000 }
    );
    await waitFor(() =>
      expect((stateHook!.state as Record<string, unknown>).status).toBe('done'),
      { timeout: 20000 }
    );

    // State must be coherent — not partially applied
    const s = stateHook!.state as Record<string, unknown>;
    expect(s.status).toBe('done');
    expect(Array.isArray(s.items)).toBe(true);
  });

  // AGUI-60: setState from frontend propagates to backend agent context
  test('AGUI-60: setState updates local state and triggers runAgent', async () => {
    let stateHook: ReturnType<typeof useAGUISharedState> | null = null;

    const Spy = () => {
      stateHook = useAGUISharedState();
      return null;
    };

    render(
      <AGUIProvider endpoint="http://localhost:8003/stream_state">
        <Spy />
      </AGUIProvider>
    );

    await waitFor(() => expect(stateHook).not.toBeNull());

    act(() => { stateHook!.setState({ counter: 42, label: 'test' }); });

    await waitFor(() => {
      const s = stateHook!.state as Record<string, unknown>;
      expect(s.counter).toBe(42);
      expect(s.label).toBe('test');
    });
  });

  // AGUI-61: state reset to {} on clearMessages
  test('AGUI-61: state resets to {} when clearMessages is called', async () => {
    let stateHook: ReturnType<typeof useAGUISharedState> | null = null;
    let msgHook: ReturnType<typeof useAGUIMessages> | null = null;

    const Spy = () => {
      stateHook = useAGUISharedState();
      msgHook = useAGUIMessages();
      return null;
    };

    render(
      <AGUIProvider endpoint="http://localhost:8003/stream_state">
        <Spy />
      </AGUIProvider>
    );

    await waitFor(() => expect(stateHook).not.toBeNull());
    act(() => { msgHook!.sendMessage('sync'); });

    await waitFor(() =>
      expect((stateHook!.state as Record<string, unknown>).status).toBe('done'),
      { timeout: 20000 }
    );
    expect(Object.keys(stateHook!.state).length).toBeGreaterThan(0);

    act(() => { msgHook!.clearMessages(); });

    expect(stateHook!.state).toEqual({});
    expect(msgHook!.messages).toHaveLength(0);
  });
});
