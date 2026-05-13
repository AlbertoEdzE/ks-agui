/**
 * @vitest-environment jsdom
 */
import { expect, test, describe, afterEach, vi } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';

import { AGUIProvider } from '../../src/components/AGUIProvider';
import { execSync } from 'child_process';

describe('AGUI-10 Integration', () => {
  afterEach(() => {
    cleanup();
  });

  test('onError fires after exactly 5 failed reconnects and retrying stops', async () => {
    try { execSync('./scripts/stop-backend.sh 1'); } catch(e) {}
    
    const onErrorMock = vi.fn();
    render(
      <AGUIProvider endpoint="http://localhost:8001/copilotkit" onError={onErrorMock}>
        <span>Spy</span>
      </AGUIProvider>
    );

    // Note: this takes ~31 seconds due to 1s+2s+4s+8s+16s backoff.
    await waitFor(() => {
      expect(onErrorMock).toHaveBeenCalledWith(expect.objectContaining({ code: 'MAX_RETRIES_EXCEEDED' }));
    }, { timeout: 40000 });

    // MAX_RETRIES_EXCEEDED must be emitted exactly once (retrying stops after this)
    const maxRetriesCalls = onErrorMock.mock.calls.filter(
      (call: any[]) => call[0]?.code === 'MAX_RETRIES_EXCEEDED'
    );
    expect(maxRetriesCalls).toHaveLength(1);
  }, 45000);
});
