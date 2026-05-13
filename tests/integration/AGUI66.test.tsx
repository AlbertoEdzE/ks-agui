/**
 * @vitest-environment jsdom
 */
import { expect, test, describe, afterEach, vi } from 'vitest';
import { render, cleanup, act, waitFor } from '@testing-library/react';
import { AGUIProvider } from '../../src/components/AGUIProvider';
import { useAGUIMessages } from '../../src/hooks/useAGUIMessages';

describe('AGUI-66: RUN_ERROR', () => {
  afterEach(() => {
    cleanup();
  });

  test('Calls onError with RUN_ERROR on backend agent error', async () => {
    const onError = vi.fn();

    let hookResult: any;
    const TestComponent = () => {
      hookResult = useAGUIMessages();
      return null;
    };

    render(
      <AGUIProvider endpoint="http://127.0.0.1:8002/trigger_error" onError={onError}>
        <TestComponent />
      </AGUIProvider>
    );

    act(() => {
      hookResult.sendMessage('Trigger error');
    });

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({
        code: 'RUN_ERROR',
        message: 'Something went wrong'
      }));
    }, { timeout: 10000 });
  });
});
