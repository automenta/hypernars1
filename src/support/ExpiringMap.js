export class ExpiringMap {
    constructor(ttl) {
        this.ttl = ttl;
        this.map = new Map();
    }

    set(key, value) {
        const expires = Date.now() + this.ttl;
        this.map.set(key, {value, expires});
    }

    get(key) {
        const entry = this.map.get(key);
        if (!entry) {
            return undefined;
        }

        if (Date.now() > entry.expires) {
            this.map.delete(key);
            return undefined;
        }

        return entry.value;
    }

    has(key) {
        return this.get(key) !== undefined;
    }

    delete(key) {
        return this.map.delete(key);
    }

    cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.map.entries()) {
            if (now > entry.expires) {
                this.map.delete(key);
            }
        }
    }

    clear() {
        this.map.clear();
    }

    [Symbol.iterator]() {
        this.cleanup();
        return this.map.entries();
    }

    entries() {
        this.cleanup();
        return this.map.entries();
    }

    keys() {
        this.cleanup();
        return this.map.keys();
    }

    values() {
        this.cleanup();
        return this.map.values();
    }
}
