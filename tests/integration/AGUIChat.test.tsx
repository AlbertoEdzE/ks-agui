/**
 * @vitest-environment jsdom
 */
import { expect, test, describe, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';
import * as React from 'react';
import { AGUIChat } from '../../src/components/AGUIChat';
import { AGUIProvider } from '../../src/components/AGUIProvider';
import * as useAGUIMessagesMod from '../../src/hooks/useAGUIMessages';
import * as useAGUIToolCallsMod from '../../src/hooks/useAGUIToolCalls';

// Mock hooks to test UI behaviors without a real backend connecting.
// Wait, "no mocks under any circumstances" applied to the backend for scenario tests!
// P1 requires unit + integration tests. The prompt says: "Use ./scripts/start-backend.sh 1 for integration and scenario tests."
// So we must use a real AGUIProvider wrapper.

describe('AGUI-26 to 31 Integration (AGUIChat)', () => {
  afterEach(() => {
    cleanup();
  });

  test('AGUIChat renders all elements and handles disabled states', async () => {
    const { getByPlaceholderText, getByText, queryByText } = render(
      <AGUIProvider endpoint="http://localhost:8001/copilotkit">
        <AGUIChat placeholder="Test placeholder..." />
      </AGUIProvider>
    );

    const input = getByPlaceholderText('Test placeholder...') as HTMLInputElement;
    const sendButton = getByText('Send') as HTMLButtonElement;

    expect(input).toBeDefined();
    expect(sendButton).toBeDefined();
    expect(input.disabled).toBe(false);
    expect(sendButton.disabled).toBe(true); // Empty input

    // Type something
    fireEvent.change(input, { target: { value: 'Hello backend' } });
    expect(sendButton.disabled).toBe(false);

    // Submit
    fireEvent.click(sendButton);

    // After submit, isStreaming should be true briefly
    await waitFor(() => {
      expect(queryByText('Agent is typing...')).not.toBeNull();
    });

    // During streaming, input should be disabled
    expect(input.disabled).toBe(true);

    // Eventually streaming stops
    await waitFor(() => {
      expect(queryByText('Agent is typing...')).toBeNull();
    }, { timeout: 10000 });

    expect(input.disabled).toBe(false);
  });
});
