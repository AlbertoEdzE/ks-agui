/**
 * @vitest-environment jsdom
 */
import { expect, test, describe, afterEach, beforeAll, afterAll } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import * as React from 'react';
import { AGUIProvider, AGUIContext } from '../../src/components/AGUIProvider';
import { execSync } from 'child_process';

describe('AGUI-8 Integration', () => {
  beforeAll(async () => {
    execSync('./scripts/start-backend.sh 1');
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
    try {
      execSync('./scripts/stop-backend.sh 1');
    } catch(e) {}
  });

  afterEach(() => {
    cleanup();
  });

  test('mounts SSE connection on render and closes on unmount', async () => {
    let agentInstance: any = null;
    const SpyComponent = () => {
      const agent = React.useContext(AGUIContext);
      React.useEffect(() => {
        if (agent) agentInstance = agent;
      }, [agent]);
      return <span>Spy</span>;
    };

    const { unmount } = render(
      <AGUIProvider endpoint="http://localhost:8001/copilotkit">
        <SpyComponent />
      </AGUIProvider>
    );

    await waitFor(() => expect(agentInstance).not.toBeNull());
    // Wait until abortController is defined (connectAgent is called)
    await waitFor(() => expect(agentInstance.abortController).toBeDefined());

    unmount();
    expect(agentInstance.abortController.signal.aborted).toBe(true);
  });
});
