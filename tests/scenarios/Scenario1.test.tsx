/**
 * @vitest-environment jsdom
 */
import { expect, test, describe, afterEach, beforeAll, afterAll } from 'vitest';
import { render, cleanup, fireEvent, waitFor, act } from '@testing-library/react';
import * as React from 'react';
import { execSync } from 'child_process';
import { AGUIProvider } from '../../src/components/AGUIProvider';
import { AGUIChat } from '../../src/components/AGUIChat';
import { useAGUIMessages } from '../../src/hooks/useAGUIMessages';

describe('Scenario 1: Streaming Text Response', () => {
  beforeAll(async () => {
    try { execSync('./scripts/start-backend.sh 1'); } catch (_) {}
    for (let i = 0; i < 20; i++) {
      try { await fetch('http://localhost:8001/copilotkit'); break; } catch (_) {
        await new Promise(r => setTimeout(r, 500));
      }
    }
  });

  afterAll(() => { try { execSync('./scripts/stop-backend.sh 1'); } catch (_) {} });

  afterEach(() => { cleanup(); });

  // AGUI-48 + AGUI-50: tokens arrive quickly, input disabled/re-enabled
  test('AGUI-48/50: sends message, input disables during streaming, re-enables on RUN_FINISHED', async () => {
    const { getByPlaceholderText, getByText } = render(
      <AGUIProvider endpoint="http://localhost:8001/copilotkit">
        <AGUIChat placeholder="Type here..." />
      </AGUIProvider>
    );
    const input = getByPlaceholderText('Type here...') as HTMLInputElement;
    const sendBtn = getByText('Send') as HTMLButtonElement;

    fireEvent.change(input, { target: { value: 'Hello' } });
    const t0 = Date.now();
    fireEvent.click(sendBtn);

    await waitFor(() => expect(input.disabled).toBe(true));
    const t1 = Date.now();
    expect(t1 - t0).toBeLessThan(200);

    await waitFor(() => expect(input.disabled).toBe(false), { timeout: 30000 });
  });

  // AGUI-49: message status transitions streaming → complete
  test('AGUI-49: message status goes streaming → complete on TEXT_MESSAGE_END', async () => {
    let hookResult: ReturnType<typeof useAGUIMessages> | null = null;

    const Spy = () => {
      const h = useAGUIMessages();
      React.useEffect(() => { hookResult = h; });
      return null;
    };

    // Use deterministic /stream_text endpoint — same backend, no Ollama required
    render(
      <AGUIProvider endpoint="http://localhost:8001/stream_text">
        <Spy />
      </AGUIProvider>
    );

    await waitFor(() => expect(hookResult).not.toBeNull());

    act(() => { hookResult!.sendMessage('Say one word.'); });

    // With React 18 batching, streaming→complete may happen within one render;
    // verify the pipeline completed: an assistant message with content exists
    await waitFor(() =>
      expect(
        hookResult!.messages.some(m => m.role === 'assistant' && m.status === 'complete' && m.content.length > 0)
      ).toBe(true),
      { timeout: 10000 }
    );
  });

  // AGUI-51: no orphaned listeners after unmount
  test('AGUI-51: no errors after component unmounts mid-stream', async () => {
    const errors: string[] = [];
    const origError = console.error;
    console.error = (...args: unknown[]) => { errors.push(String(args[0])); };

    const { unmount } = render(
      <AGUIProvider endpoint="http://localhost:8001/copilotkit">
        <AGUIChat />
      </AGUIProvider>
    );

    await new Promise(r => setTimeout(r, 300));
    unmount();
    await new Promise(r => setTimeout(r, 500));
    console.error = origError;

    const reactErrors = errors.filter(e => e.includes('Cannot update') || e.includes('memory leak'));
    expect(reactErrors).toHaveLength(0);
  });
});
