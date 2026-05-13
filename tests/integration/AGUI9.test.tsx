/**
 * @vitest-environment jsdom
 */
import { expect, test, describe, afterEach, beforeAll, afterAll } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import * as React from 'react';
import { AGUIProvider } from '../../src/components/AGUIProvider';
import { AGUIContext } from '../../src/hooks/useAGUIConnection';
import { execSync } from 'child_process';

describe('AGUI-9 Integration', () => {
  beforeAll(async () => {
    try { execSync('./scripts/start-backend.sh 1'); } catch (_) {}
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

  test('reconnects automatically on connection drop', async () => {
    let connectionCount = 0;
    
    const SpyComponent = () => {
      const agent = React.useContext(AGUIContext);
      React.useEffect(() => {
        if (agent) connectionCount++;
      }, [agent]);
      return <span>Spy</span>;
    };

    render(
      <AGUIProvider endpoint="http://localhost:8001/copilotkit">
        <SpyComponent />
      </AGUIProvider>
    );

    // Wait for first connection
    await waitFor(() => expect(connectionCount).toBe(1));
    
    // Kill the backend to induce a real connection drop
    execSync('./scripts/stop-backend.sh 1');
    
    // It should try to reconnect and setAgent with a new HttpAgent instance
    await waitFor(() => expect(connectionCount).toBe(2), { timeout: 3000 });
  }, 10000);
});
