import { expectTypeOf, describe, it } from 'vitest';
import { AGUIToolCall } from '../../../src/types';

describe('AGUIToolCall type validity', () => {
  it('should match the specification', () => {
    expectTypeOf<AGUIToolCall>().toHaveProperty('id');
    expectTypeOf<AGUIToolCall['id']>().toBeString();
    
    expectTypeOf<AGUIToolCall>().toHaveProperty('name');
    expectTypeOf<AGUIToolCall['name']>().toBeString();
    
    expectTypeOf<AGUIToolCall>().toHaveProperty('args');
    expectTypeOf<AGUIToolCall['args']>().toEqualTypeOf<Record<string, unknown>>();
    
    expectTypeOf<AGUIToolCall>().toHaveProperty('status');
    expectTypeOf<AGUIToolCall['status']>().toEqualTypeOf<'pending' | 'approved' | 'rejected' | 'executing' | 'complete' | 'awaiting_confirmation'>();
    
    expectTypeOf<AGUIToolCall>().toHaveProperty('result');
    expectTypeOf<AGUIToolCall['result']>().toEqualTypeOf<unknown | undefined>();
  });
});
