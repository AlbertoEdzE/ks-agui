/**
 * @vitest-environment jsdom
 */
import { expect, test, describe, afterEach, vi } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import * as React from 'react';
import { AGUIProvider } from '../../src/components/AGUIProvider';

describe('AGUI-63: MAX_RETRIES_EXCEEDED', () => {
  afterEach(() => {
    cleanup();
  });

  test('Calls onError with MAX_RETRIES_EXCEEDED after 5 consecutive failed reconnects', async () => {
    const onError = vi.fn();

    render(
      <AGUIProvider endpoint="http://localhost:9999/copilotkit" onError={onError}>
        <div>Test</div>
      </AGUIProvider>
    );

    // Initial connection fails -> CONNECTION_FAILED
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({
        code: 'CONNECTION_FAILED'
      }));
    });

    // Wait for all 5 retries to fail.
    // Exponential backoff is: 1s, 2s, 4s, 8s, 16s. Total = 31 seconds.
    // So we wait for 35 seconds to be safe.
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({
        code: 'MAX_RETRIES_EXCEEDED'
      }));
    }, { timeout: 40000, interval: 1000 });
  }, 45000);
});
