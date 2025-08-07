import { describe, it, expect } from '@jest/globals';
import { clamp } from './utils.js';

describe('clamp', () => {
    it('should not alter a number within the bounds', () => {
        expect(clamp(5, 0, 10)).toBe(5);
    });

    it('should clamp a number below the lower bound', () => {
        expect(clamp(-5, 0, 10)).toBe(0);
    });

    it('should clamp a number above the upper bound', () => {
        expect(clamp(15, 0, 10)).toBe(10);
    });

    it('should work with negative bounds', () => {
        expect(clamp(5, -10, 0)).toBe(0);
        expect(clamp(-15, -10, 0)).toBe(-10);
        expect(clamp(-5, -10, 0)).toBe(-5);
    });
});
