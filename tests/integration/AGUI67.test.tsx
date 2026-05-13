/**
 * @vitest-environment jsdom
 */
import { expect, test, describe, afterEach, vi } from 'vitest';
import { render, cleanup, act, waitFor } from '@testing-library/react';
import { AGUIProvider } from '../../src/components/AGUIProvider';
import { useAGUIMessages } from '../../src/hooks/useAGUIMessages';

describe('AGUI-67: INVALID_STATE_PATCH', () => {
  afterEach(() => {
    cleanup();
  });

  test('Logs to console.warn on invalid JSON Patch and continues', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    let msgHook: any;
    const TestComponent = () => {
      msgHook = useAGUIMessages();
      return null;
    };

    render(
      <AGUIProvider endpoint="http://127.0.0.1:8002/bad_patch">
        <TestComponent />
      </AGUIProvider>
    );

    act(() => {
      msgHook.sendMessage('Trigger bad patch');
    });

    await waitFor(() => {
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('INVALID_STATE_PATCH'), expect.anything());
    }, { timeout: 14000 });
  }, 15000);
});
