import {PriorityQueue} from './PriorityQueue.js';

describe('PriorityQueue', () => {
    // Mock items with a budget structure, as expected by the default comparator
    const highPriorityItem = {id: 'high', budget: {priority: 0.9}};
    const midPriorityItem = {id: 'mid', budget: {priority: 0.5}};
    const lowPriorityItem = {id: 'low', budget: {priority: 0.1}};
    const anotherMidPriorityItem = {id: 'mid2', budget: {priority: 0.5}};

    it('should initialize as an empty queue', () => {
        const pq = new PriorityQueue();
        expect(pq.length).toBe(0);
        expect(pq.peek()).toBeUndefined();
    });

    it('should push items and increase the length', () => {
        const pq = new PriorityQueue();
        pq.push(lowPriorityItem);
        expect(pq.length).toBe(1);
        pq.push(highPriorityItem);
        expect(pq.length).toBe(2);
    });

    it('should peek at the highest priority item without removing it', () => {
        const pq = new PriorityQueue();
        pq.push(lowPriorityItem);
        pq.push(highPriorityItem);
        pq.push(midPriorityItem);
        expect(pq.peek()).toBe(highPriorityItem);
        expect(pq.length).toBe(3);
    });

    it('should pop the highest priority item', () => {
        const pq = new PriorityQueue();
        pq.push(lowPriorityItem);
        pq.push(highPriorityItem);
        pq.push(midPriorityItem);

        expect(pq.pop()).toBe(highPriorityItem);
        expect(pq.length).toBe(2);
        expect(pq.peek()).toBe(midPriorityItem);
    });

    it('should handle popping from an empty queue', () => {
        const pq = new PriorityQueue();
        expect(pq.pop()).toBeNull();
    });

    it('should maintain the correct order after multiple pushes and pops', () => {
        const pq = new PriorityQueue();
        pq.push(midPriorityItem);
        pq.push(lowPriorityItem);
        pq.push(highPriorityItem);

        expect(pq.pop()).toBe(highPriorityItem);

        pq.push(lowPriorityItem); // Add another low priority
        pq.push(anotherMidPriorityItem); // Add another mid priority

        expect(pq.pop()).toBe(midPriorityItem); // or anotherMidPriorityItem
        expect(pq.pop()).toBe(anotherMidPriorityItem); // or midPriorityItem
        expect(pq.pop()).toBe(lowPriorityItem);
        expect(pq.pop()).toBe(lowPriorityItem);
        expect(pq.length).toBe(0);
    });

    it('should handle items with the same priority', () => {
        const pq = new PriorityQueue();
        pq.push(midPriorityItem);
        pq.push(anotherMidPriorityItem);
        pq.push(highPriorityItem);

        expect(pq.pop()).toBe(highPriorityItem);
        // The next two could be in any order, as their priority is the same
        const item1 = pq.pop();
        const item2 = pq.pop();
        const ids = [item1.id, item2.id];
        expect(ids).toContain('mid');
        expect(ids).toContain('mid2');
    });

    it('should work correctly with a large number of items', () => {
        const pq = new PriorityQueue();
        const items = [];
        for (let i = 0; i < 1000; i++) {
            const item = {budget: {priority: Math.random()}};
            items.push(item);
            pq.push(item);
        }

        items.sort((a, b) => b.budget.priority - a.budget.priority);

        for (let i = 0; i < 1000; i++) {
            expect(pq.pop()).toBe(items[i]);
        }
        expect(pq.length).toBe(0);
    });

    describe('with Custom Comparator (Min-Heap)', () => {
        const minComparator = (a, b) => a.priority - b.priority;
        const highPrio = {priority: 10};
        const midPrio = {priority: 5};
        const lowPrio = {priority: 1};

        it('should pop the lowest priority item first', () => {
            const pq = new PriorityQueue(minComparator);
            pq.push(highPrio);
            pq.push(lowPrio);
            pq.push(midPrio);

            expect(pq.peek()).toBe(lowPrio);
            expect(pq.pop()).toBe(lowPrio);
            expect(pq.pop()).toBe(midPrio);
            expect(pq.pop()).toBe(highPrio);
        });
    });

    describe('filter', () => {
        it('should remove items that do not satisfy the predicate', () => {
            const pq = new PriorityQueue();
            pq.push(lowPriorityItem);
            pq.push(highPriorityItem);
            pq.push(midPriorityItem);

            pq.filter(item => item.budget.priority > 0.3);

            expect(pq.length).toBe(2);
            expect(pq.peek()).toBe(highPriorityItem);
        });

        it('should correctly re-heapify the queue after filtering', () => {
            const pq = new PriorityQueue();
            pq.push(lowPriorityItem); // 0.1
            pq.push(highPriorityItem); // 0.9
            pq.push(midPriorityItem); // 0.5
            pq.push({id: 'high2', budget: {priority: 0.95}});
            pq.push({id: 'low2', budget: {priority: 0.05}});

            // Filter out the highest priority item
            pq.filter(item => item.id !== 'high2');

            expect(pq.length).toBe(4);
            expect(pq.pop()).toBe(highPriorityItem);
            expect(pq.pop()).toBe(midPriorityItem);
            expect(pq.pop()).toBe(lowPriorityItem);
            expect(pq.pop()).toStrictEqual({id: 'low2', budget: {priority: 0.05}});
        });

        it('should handle filtering that results in an empty queue', () => {
            const pq = new PriorityQueue();
            pq.push(lowPriorityItem);
            pq.push(midPriorityItem);

            pq.filter(() => false);

            expect(pq.length).toBe(0);
            expect(pq.peek()).toBeUndefined();
        });

        it('should do nothing if all items satisfy the predicate', () => {
            const pq = new PriorityQueue();
            pq.push(lowPriorityItem);
            pq.push(highPriorityItem);
            pq.push(midPriorityItem);

            pq.filter(() => true);

            expect(pq.length).toBe(3);
            expect(pq.peek()).toBe(highPriorityItem);
        });
    });
});
