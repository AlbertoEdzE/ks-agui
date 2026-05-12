import { expectTypeOf, describe, it } from 'vitest';
import { AGUIMessage } from '../../../src/types';

describe('AGUIMessage type validity', () => {
  it('should match the specification', () => {
    expectTypeOf<AGUIMessage>().toHaveProperty('id');
    expectTypeOf<AGUIMessage['id']>().toBeString();
    
    expectTypeOf<AGUIMessage>().toHaveProperty('role');
    expectTypeOf<AGUIMessage['role']>().toEqualTypeOf<'assistant' | 'user'>();
    
    expectTypeOf<AGUIMessage>().toHaveProperty('content');
    expectTypeOf<AGUIMessage['content']>().toBeString();
    
    expectTypeOf<AGUIMessage>().toHaveProperty('status');
    expectTypeOf<AGUIMessage['status']>().toEqualTypeOf<'streaming' | 'complete'>();
    
    expectTypeOf<AGUIMessage>().toHaveProperty('createdAt');
    expectTypeOf<AGUIMessage['createdAt']>().toBeNumber();
  });
});
