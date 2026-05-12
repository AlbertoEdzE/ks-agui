import { expectTypeOf, describe, it } from 'vitest';
import type { ReactNode } from 'react';
import { AGUIProviderProps, AGUIError } from '../../../src/types';

describe('AGUIProviderProps type validity', () => {
  it('should match the specification', () => {
    expectTypeOf<AGUIProviderProps>().toHaveProperty('endpoint');
    expectTypeOf<AGUIProviderProps['endpoint']>().toBeString();
    
    expectTypeOf<AGUIProviderProps>().toHaveProperty('headers');
    expectTypeOf<AGUIProviderProps['headers']>().toEqualTypeOf<Record<string, string> | undefined>();
    
    expectTypeOf<AGUIProviderProps>().toHaveProperty('threadId');
    expectTypeOf<AGUIProviderProps['threadId']>().toEqualTypeOf<string | undefined>();
    
    expectTypeOf<AGUIProviderProps>().toHaveProperty('onError');
    expectTypeOf<AGUIProviderProps['onError']>().toEqualTypeOf<((error: AGUIError) => void) | undefined>();
    
    expectTypeOf<AGUIProviderProps>().toHaveProperty('children');
    expectTypeOf<AGUIProviderProps['children']>().toEqualTypeOf<ReactNode>();
  });
});
