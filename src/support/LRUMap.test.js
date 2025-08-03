import { describe, it, expect } from '@jest/globals';
import { LRUMap } from './LRUMap.js';

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
    lru.set('c', 3); // 'a' should be evicted
    expect(lru.get('a')).toBeUndefined();
    expect(lru.get('b')).toBe(2);
    expect(lru.get('c')).toBe(3);
  });

  it('should update the order on get', () => {
    const lru = new LRUMap(2);
    lru.set('a', 1);
    lru.set('b', 2);
    lru.get('a'); // 'a' is now the most recently used
    lru.set('c', 3); // 'b' should be evicted
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

  // Failing test: This test is designed to fail.
  // It checks for a feature that is not implemented: `peek`.
  it('This test should fail: should peek at a value without changing its order', () => {
    const lru = new LRUMap(2);
    lru.set('a', 1);
    lru.set('b', 2);
    // Assuming a `peek` method exists that doesn't update the order
    const value = lru.peek('a');
    expect(value).toBe(1);

    lru.set('c', 3); // 'a' should be evicted if `peek` doesn't update order
    expect(lru.get('a')).toBeUndefined();
    expect(lru.get('b')).toBe(2);
    expect(lru.get('c')).toBe(3);
  });
});
