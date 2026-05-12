import { expectTypeOf, describe, it } from 'vitest';
describe('AGUIError type validity', () => {
    it('should match the specification', () => {
        expectTypeOf().toHaveProperty('code');
        expectTypeOf().toEqualTypeOf();
        expectTypeOf().toHaveProperty('message');
        expectTypeOf().toEqualTypeOf();
        expectTypeOf().toHaveProperty('originalEvent');
        expectTypeOf().toEqualTypeOf();
    });
});
