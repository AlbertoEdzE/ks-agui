import { expectTypeOf, describe, it } from 'vitest';
describe('AGUIChatProps type validity', () => {
    it('should match the specification', () => {
        expectTypeOf().toHaveProperty('placeholder');
        expectTypeOf().toEqualTypeOf();
        expectTypeOf().toHaveProperty('className');
        expectTypeOf().toEqualTypeOf();
        expectTypeOf().toHaveProperty('renderMessage');
        expectTypeOf().toEqualTypeOf();
        expectTypeOf().toHaveProperty('renderToolCall');
        expectTypeOf().toEqualTypeOf();
    });
});
