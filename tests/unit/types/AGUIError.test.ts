import { expectTypeOf, describe, it } from 'vitest';
import { AGUIError } from '../../../src/types';

describe('AGUIError type validity', () => {
  it('should match the specification', () => {
    expectTypeOf<AGUIError>().toHaveProperty('code');
    expectTypeOf<AGUIError['code']>().toEqualTypeOf<'CONNECTION_FAILED' | 'MAX_RETRIES_EXCEEDED' | 'PARSE_ERROR' | 'TOOL_REJECTED' | 'RUN_ERROR' | 'INVALID_STATE_PATCH'>();
    
    expectTypeOf<AGUIError>().toHaveProperty('message');
    expectTypeOf<AGUIError['message']>().toEqualTypeOf<string | undefined>();
    
    expectTypeOf<AGUIError>().toHaveProperty('originalEvent');
    expectTypeOf<AGUIError['originalEvent']>().toEqualTypeOf<Event | undefined>();
  });
});
