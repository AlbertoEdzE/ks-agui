import { expectTypeOf, describe, it } from 'vitest';
describe('AGUIToolCall type validity', () => {
    it('should match the specification', () => {
        expectTypeOf().toHaveProperty('id');
        expectTypeOf().toBeString();
        expectTypeOf().toHaveProperty('name');
        expectTypeOf().toBeString();
        expectTypeOf().toHaveProperty('args');
        expectTypeOf().toEqualTypeOf();
        expectTypeOf().toHaveProperty('status');
        expectTypeOf().toEqualTypeOf();
        expectTypeOf().toHaveProperty('result');
        expectTypeOf().toEqualTypeOf();
    });
});
