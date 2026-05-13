/**
 * @vitest-environment jsdom
 */
import { expect, test, describe, afterEach, vi } from 'vitest';
import { render, cleanup, act, waitFor } from '@testing-library/react';
import { AGUIProvider } from '../../src/components/AGUIProvider';
import { useAGUIMessages } from '../../src/hooks/useAGUIMessages';

describe('AGUI-64: PARSE_ERROR', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test('Logs to console.warn on malformed SSE payload and continues', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    let hookResult: any;
    const TestComponent = () => {
      hookResult = useAGUIMessages();
      return null;
    };

    render(
      <AGUIProvider endpoint="http://127.0.0.1:8001/malformed_sse">
        <TestComponent />
      </AGUIProvider>
    );

    await waitFor(() => {
      expect(hookResult.messages).toBeDefined();
    });

    act(() => {
      hookResult.sendMessage('Trigger malformed response');
    });

    await waitFor(() => {
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('PARSE_ERROR'), expect.anything());
    }, { timeout: 10000 });

    expect(hookResult.isStreaming).toBe(false);
  });
});
