/**
 * @vitest-environment jsdom
 */
import { expect, test, describe, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { AGUIMessage } from '../../src/components/AGUIMessage';
import { AGUIMessage as AGUIMessageType } from '../../src/types';

describe('AGUI-23 Component Integration', () => {
  afterEach(() => {
    cleanup();
  });

  test('AGUIMessage renders correctly based on role and status', () => {
    const userMsg: AGUIMessageType = {
      id: 'msg-1',
      role: 'user',
      content: 'Hello world',
      status: 'complete',
      createdAt: Date.now()
    };

    const { getByText, rerender } = render(<AGUIMessage message={userMsg} />);
    expect(getByText('User')).toBeDefined();
    expect(getByText('Hello world')).toBeDefined();

    const assistantMsg: AGUIMessageType = {
      id: 'msg-2',
      role: 'assistant',
      content: 'I am streaming',
      status: 'streaming',
      createdAt: Date.now()
    };

    rerender(<AGUIMessage message={assistantMsg} />);
    expect(getByText('Assistant')).toBeDefined();
    expect(getByText('I am streaming')).toBeDefined();
    expect(getByText('...')).toBeDefined(); // streaming indicator
  });
});
