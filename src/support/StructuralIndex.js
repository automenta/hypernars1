export class StructuralIndex {
    constructor() {
        this.map = new Map();
    }

    addToIndex(hyperedge) {
        const key = `${hyperedge.type}:${hyperedge.args.length}`;
        if (!this.map.has(key)) {
            this.map.set(key, new Set());
        }
        this.map.get(key).add(hyperedge.id);
    }

    removeFromIndex(hyperedge) {
        const key = `${hyperedge.type}:${hyperedge.args.length}`;
        if (this.map.has(key)) {
            this.map.get(key).delete(hyperedge.id);
        }
    }
}
