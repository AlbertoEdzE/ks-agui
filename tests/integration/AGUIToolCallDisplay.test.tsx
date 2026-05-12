/**
 * @vitest-environment jsdom
 */
import { expect, test, describe, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { AGUIToolCallDisplay } from '../../src/components/AGUIToolCallDisplay';
import { AGUIToolCall } from '../../src/types';

describe('AGUI-24 Component Integration', () => {
  afterEach(() => {
    cleanup();
  });

  test('AGUIToolCallDisplay renders tool call details correctly', () => {
    const toolCall: AGUIToolCall = {
      id: 'call-1',
      name: 'getWeather',
      args: { location: 'Seattle' },
      status: 'pending'
    };

    const { getByText, rerender } = render(<AGUIToolCallDisplay toolCall={toolCall} />);
    
    expect(getByText('⚙️ Tool Call: getWeather')).toBeDefined();
    expect(getByText(/pending/)).toBeDefined();
    expect(getByText(/"location":\s*"Seattle"/)).toBeDefined();

    const completeCall: AGUIToolCall = {
      ...toolCall,
      status: 'approved',
      result: { temperature: 72 }
    };

    rerender(<AGUIToolCallDisplay toolCall={completeCall} />);
    expect(getByText(/approved/)).toBeDefined();
    expect(getByText(/"temperature":\s*72/)).toBeDefined();
  });
});
