import { expectTypeOf, describe, it } from 'vitest';
describe('AGUIProviderProps type validity', () => {
    it('should match the specification', () => {
        expectTypeOf().toHaveProperty('endpoint');
        expectTypeOf().toBeString();
        expectTypeOf().toHaveProperty('headers');
        expectTypeOf().toEqualTypeOf();
        expectTypeOf().toHaveProperty('threadId');
        expectTypeOf().toEqualTypeOf();
        expectTypeOf().toHaveProperty('onError');
        expectTypeOf().toEqualTypeOf();
        expectTypeOf().toHaveProperty('children');
        expectTypeOf().toEqualTypeOf();
    });
});
