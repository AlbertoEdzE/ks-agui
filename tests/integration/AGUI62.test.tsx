/**
 * @vitest-environment jsdom
 */
import { expect, test, describe, afterEach, vi } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import * as React from 'react';
import { AGUIProvider } from '../../src/components/AGUIProvider';
import { AGUIError } from '../../src/types';

describe('AGUI-62: CONNECTION_FAILED', () => {
  afterEach(() => {
    cleanup();
  });

  test('Calls onError with CONNECTION_FAILED when pointing to a non-existent port', async () => {
    const onError = vi.fn();

    render(
      <AGUIProvider endpoint="http://localhost:9999/copilotkit" onError={onError}>
        <div>Test</div>
      </AGUIProvider>
    );

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({
        code: 'CONNECTION_FAILED'
      }));
    }, { timeout: 5000 });
  });
});
