import { expectTypeOf, describe, it } from 'vitest';
describe('AGUIMessage type validity', () => {
    it('should match the specification', () => {
        expectTypeOf().toHaveProperty('id');
        expectTypeOf().toBeString();
        expectTypeOf().toHaveProperty('role');
        expectTypeOf().toEqualTypeOf();
        expectTypeOf().toHaveProperty('content');
        expectTypeOf().toBeString();
        expectTypeOf().toHaveProperty('status');
        expectTypeOf().toEqualTypeOf();
        expectTypeOf().toHaveProperty('createdAt');
        expectTypeOf().toBeNumber();
    });
});
