export class LRUMap {
    constructor(maxSize) {
        this.maxSize = maxSize;
        this.map = new Map();
    }

    get(key) {
        const value = this.map.get(key);
        if (value !== undefined) {
            this.map.delete(key);
            this.map.set(key, value);
        }
        return value;
    }

    peek(key) {
        return this.map.get(key);
    }

    set(key, value) {
        if (this.map.has(key)) {
            this.map.delete(key);
        } else if (this.map.size >= this.maxSize) {
            const firstKey = this.map.keys().next().value;
            this.map.delete(firstKey);
        }
        this.map.set(key, value);
        return this;
    }

    has(key) {
        return this.map.has(key);
    }
}
