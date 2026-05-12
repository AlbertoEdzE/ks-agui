/**
 * @vitest-environment jsdom
 */
import { expect, test, describe, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import * as React from 'react';
import { AGUIProvider } from '../../src/components/AGUIProvider';

describe('AGUI-11 Integration', () => {
  afterEach(() => {
    cleanup();
  });

  test('AGUIProvider renders zero visible DOM nodes', () => {
    const { container } = render(
      <AGUIProvider endpoint="http://localhost:8001/copilotkit">
        <div id="test-child">Child</div>
      </AGUIProvider>
    );
    
    expect(container.innerHTML).toBe('<div id="test-child">Child</div>');
  });
});
