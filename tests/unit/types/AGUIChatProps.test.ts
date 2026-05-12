import { expectTypeOf, describe, it } from 'vitest';
import type { ReactNode } from 'react';
import { AGUIChatProps, AGUIMessage, AGUIToolCall } from '../../../src/types';

describe('AGUIChatProps type validity', () => {
  it('should match the specification', () => {
    expectTypeOf<AGUIChatProps>().toHaveProperty('placeholder');
    expectTypeOf<AGUIChatProps['placeholder']>().toEqualTypeOf<string | undefined>();
    
    expectTypeOf<AGUIChatProps>().toHaveProperty('className');
    expectTypeOf<AGUIChatProps['className']>().toEqualTypeOf<string | undefined>();
    
    expectTypeOf<AGUIChatProps>().toHaveProperty('renderMessage');
    expectTypeOf<AGUIChatProps['renderMessage']>().toEqualTypeOf<((message: AGUIMessage) => ReactNode) | undefined>();
    
    expectTypeOf<AGUIChatProps>().toHaveProperty('renderToolCall');
    expectTypeOf<AGUIChatProps['renderToolCall']>().toEqualTypeOf<((toolCall: AGUIToolCall) => ReactNode) | undefined>();
  });
});
