import {describe, expect, it} from '@jest/globals';
import {LRUMap} from './LRUMap.js';

describe('LRUMap', () => {
    it('should set and get values', () => {
        const lru = new LRUMap(2);
        lru.set('a', 1);
        lru.set('b', 2);
        expect(lru.get('a')).toBe(1);
        expect(lru.get('b')).toBe(2);
    });

    it('should evict the least recently used item', () => {
        const lru = new LRUMap(2);
        lru.set('a', 1);
        lru.set('b', 2);
        lru.set('c', 3);
        expect(lru.get('a')).toBeUndefined();
        expect(lru.get('b')).toBe(2);
        expect(lru.get('c')).toBe(3);
    });

    it('should update the order on get', () => {
        const lru = new LRUMap(2);
        lru.set('a', 1);
        lru.set('b', 2);
        lru.get('a');
        lru.set('c', 3);
        expect(lru.get('b')).toBeUndefined();
        expect(lru.get('a')).toBe(1);
        expect(lru.get('c')).toBe(3);
    });

    it('should handle getting a non-existent key', () => {
        const lru = new LRUMap(2);
        expect(lru.get('a')).toBeUndefined();
    });

    it('should update the value of an existing key', () => {
        const lru = new LRUMap(2);
        lru.set('a', 1);
        lru.set('a', 100);
        expect(lru.get('a')).toBe(100);
    });

    it('should work with a maxSize of 1', () => {
        const lru = new LRUMap(1);
        lru.set('a', 1);
        lru.set('b', 2);
        expect(lru.get('a')).toBeUndefined();
        expect(lru.get('b')).toBe(2);
    });



    it('This test should fail: should peek at a value without changing its order', () => {
        const lru = new LRUMap(2);
        lru.set('a', 1);
        lru.set('b', 2);

        const value = lru.peek('a');
        expect(value).toBe(1);

        lru.set('c', 3);
        expect(lru.get('a')).toBeUndefined();
        expect(lru.get('b')).toBe(2);
        expect(lru.get('c')).toBe(3);
    });
});
