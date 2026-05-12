/**
 * @vitest-environment jsdom
 */
import { expect, test, describe, afterEach, } from 'vitest';
import { render, cleanup, waitFor, act } from '@testing-library/react';
import * as React from 'react';
import { AGUIProvider } from '../../src/components/AGUIProvider';
import { useAGUISharedState } from '../../src/hooks/useAGUISharedState';

describe('AGUI-20 to 22 Integration', () => {

  afterEach(() => {
    cleanup();
  });

  test('useAGUISharedState full suite (20, 21, 22)', async () => {
    let hookResult: any = null;
    
    const SpyComponent = () => {
      const stateObj = useAGUISharedState();
      React.useEffect(() => {
        hookResult = stateObj;
      });
      return <span>Spy</span>;
    };

    render(
      <AGUIProvider endpoint="http://localhost:8001/copilotkit">
        <SpyComponent />
      </AGUIProvider>
    );

    await waitFor(() => expect(hookResult).not.toBeNull());

    // AGUI-22: Initial state is {}
    expect(hookResult.state).toEqual({});

    // Simulate AGUI-21: setState
    act(() => {
      hookResult.setState({ key: 'value' });
    });

    expect(hookResult.state).toEqual({ key: 'value' });
  });
});
