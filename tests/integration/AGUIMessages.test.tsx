/**
 * @vitest-environment jsdom
 */
import { expect, test, describe, afterEach, beforeAll, afterAll } from 'vitest';
import { render, cleanup, waitFor, act } from '@testing-library/react';
import * as React from 'react';
import { AGUIProvider } from '../../src/components/AGUIProvider';
import { useAGUIMessages } from '../../src/hooks/useAGUIMessages';
import { execSync } from 'child_process';

describe('AGUI-12 to 15 Integration', () => {
  beforeAll(async () => {
    try { execSync('./scripts/start-backend.sh 1'); } catch(e) {}
    for(let i=0; i<10; i++) {
      try {
        await fetch('http://localhost:8001/copilotkit');
        break;
      } catch(e) {
        await new Promise(r => setTimeout(r, 500));
      }
    }
  });

  afterAll(() => {
    try { execSync('./scripts/stop-backend.sh 1'); } catch(e) {}
  });

  afterEach(() => {
    cleanup();
  });

  test('useAGUIMessages full suite (12, 13, 14, 15)', async () => {
    let hookResult: any = null;
    let renderCount = 0;
    
    const SpyComponent = () => {
      const messagesObj = useAGUIMessages();
      React.useEffect(() => {
        hookResult = messagesObj;
        renderCount++;
      });
      return <span>Spy</span>;
    };

    render(
      <AGUIProvider endpoint="http://localhost:8001/copilotkit">
        <SpyComponent />
      </AGUIProvider>
    );

    // Wait until agent connects
    await waitFor(() => expect(hookResult).not.toBeNull());

    const initialRenderCount = renderCount;

    // AGUI-13: sendMessage emits RUN_STARTED and appends locally
    act(() => {
      hookResult.sendMessage('Hello');
    });

    // Check local append
    expect(hookResult.messages).toHaveLength(1);
    expect(hookResult.messages[0].content).toBe('Hello');
    expect(hookResult.messages[0].role).toBe('user');

    // AGUI-14: isStreaming becomes true (since runAgent was called)
    await waitFor(() => expect(hookResult.isStreaming).toBe(true));

    // Wait until isStreaming flips back to false (which means the empty run finished)
    await waitFor(() => expect(hookResult.isStreaming).toBe(false), { timeout: 10000 });

    // AGUI-15: clearMessages resets local state only
    act(() => {
      hookResult.clearMessages();
    });
    expect(hookResult.messages).toHaveLength(0);
  });
});
