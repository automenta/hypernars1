import { StructuralIndex } from './StructuralIndex.js';

describe('StructuralIndex', () => {
    let index;

    // Mock hyperedges with id, type, and args
    const inheritanceEdge1 = { id: 'h1', type: 'Inheritance', args: ['A', 'B'] };
    const inheritanceEdge2 = { id: 'h2', type: 'Inheritance', args: ['C', 'D'] };
    const similarityEdge = { id: 'h3', type: 'Similarity', args: ['X', 'Y'] };
    const ternaryEdge = { id: 'h4', type: 'SomeTernary', args: [1, 2, 3] };
    const nonExistentEdge = { id: 'h99', type: 'Inheritance', args: ['Y', 'Z'] };


    beforeEach(() => {
        index = new StructuralIndex();
    });

    it('should initialize with an empty map', () => {
        expect(index.map.size).toBe(0);
    });

    describe('addToIndex', () => {
        it('should create a new set for a new hyperedge type and arity', () => {
            index.addToIndex(inheritanceEdge1);
            const key = 'Inheritance:2';
            expect(index.map.has(key)).toBe(true);
            expect(index.map.get(key)).toBeInstanceOf(Set);
            expect(index.map.get(key).size).toBe(1);
        });

        it('should add a hyperedge ID to the correct group', () => {
            index.addToIndex(inheritanceEdge1);
            const key = 'Inheritance:2';
            expect(index.map.get(key).has('h1')).toBe(true);
        });

        it('should add multiple hyperedges to the same group', () => {
            index.addToIndex(inheritanceEdge1);
            index.addToIndex(inheritanceEdge2);
            const key = 'Inheritance:2';
            expect(index.map.get(key).size).toBe(2);
            expect(index.map.get(key).has('h1')).toBe(true);
            expect(index.map.get(key).has('h2')).toBe(true);
        });

        it('should add hyperedges to different groups based on type', () => {
            index.addToIndex(inheritanceEdge1);
            index.addToIndex(similarityEdge);
            const key1 = 'Inheritance:2';
            const key2 = 'Similarity:2';
            expect(index.map.get(key1).has('h1')).toBe(true);
            expect(index.map.get(key2).has('h3')).toBe(true);
            expect(index.map.size).toBe(2);
        });

        it('should add hyperedges to different groups based on arity', () => {
            index.addToIndex(inheritanceEdge1);
            index.addToIndex(ternaryEdge);
            const key1 = 'Inheritance:2';
            const key2 = 'SomeTernary:3';
            expect(index.map.get(key1).has('h1')).toBe(true);
            expect(index.map.get(key2).has('h4')).toBe(true);
            expect(index.map.size).toBe(2);
        });
    });

    describe('removeFromIndex', () => {
        beforeEach(() => {
            index.addToIndex(inheritanceEdge1);
            index.addToIndex(inheritanceEdge2);
            index.addToIndex(similarityEdge);
        });

        it('should remove a hyperedge ID from its group', () => {
            const key = 'Inheritance:2';
            expect(index.map.get(key).has('h1')).toBe(true);
            index.removeFromIndex(inheritanceEdge1);
            expect(index.map.get(key).has('h1')).toBe(false);
        });

        it('should not affect other hyperedges in the same group', () => {
            const key = 'Inheritance:2';
            index.removeFromIndex(inheritanceEdge1);
            expect(index.map.get(key).has('h2')).toBe(true);
            expect(index.map.get(key).size).toBe(1);
        });

        it('should not affect other groups', () => {
            const key1 = 'Inheritance:2';
            const key2 = 'Similarity:2';
            index.removeFromIndex(inheritanceEdge1);
            expect(index.map.get(key1).size).toBe(1);
            expect(index.map.get(key2).size).toBe(1);
            expect(index.map.get(key2).has('h3')).toBe(true);
        });

        it('should leave an empty set if the last hyperedge is removed from a group', () => {
            const key = 'Similarity:2';
            index.removeFromIndex(similarityEdge);
            expect(index.map.has(key)).toBe(true);
            expect(index.map.get(key).size).toBe(0);
        });

        it('should not throw an error if removing a non-existent hyperedge', () => {
            expect(() => index.removeFromIndex(nonExistentEdge)).not.toThrow();
        });

        it('should not throw an error if removing from a non-existent group', () => {
            const edge = { id: 'h5', type: 'NonExistentType', args: [1, 2] };
            expect(() => index.removeFromIndex(edge)).not.toThrow();
        });
    });
});
