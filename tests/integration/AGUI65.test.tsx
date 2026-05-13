/**
 * @vitest-environment jsdom
 */
import { expect, test, describe, afterEach, vi } from 'vitest';
import { render, cleanup, act, waitFor } from '@testing-library/react';
import { AGUIProvider } from '../../src/components/AGUIProvider';
import { useAGUIToolCalls } from '../../src/hooks/useAGUIToolCalls';
import { useAGUIMessages } from '../../src/hooks/useAGUIMessages';

describe('AGUI-65: TOOL_REJECTED', () => {
  afterEach(() => {
    cleanup();
  });

  test('Calls onError with TOOL_REJECTED and unblocks input on rejection', async () => {
    const onError = vi.fn();

    let hookResult: any;
    let msgHook: any;
    const TestComponent = () => {
      hookResult = useAGUIToolCalls();
      msgHook = useAGUIMessages();
      return null;
    };

    render(
      <AGUIProvider endpoint="http://127.0.0.1:8002/reject_tool" onError={onError}>
        <TestComponent />
      </AGUIProvider>
    );

    // Trigger rejection
    act(() => {
      hookResult.rejectToolCall('call_123');
    });

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({
        code: 'TOOL_REJECTED'
      }));
    }, { timeout: 10000 });

    // Verify input is unblocked
    expect(msgHook.isStreaming).toBe(false);
  });
});
