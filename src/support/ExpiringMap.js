/**
 * A Map-like data structure where entries expire after a specified time-to-live (TTL).
 */
export class ExpiringMap {
    /**
     * @param {number} ttl - The default time-to-live for entries in milliseconds.
     */
    constructor(ttl) {
        this.ttl = ttl;
        this.map = new Map();
    }

    /**
     * Sets a value for a key, with an associated expiration time.
     * @param {any} key
     * @param {any} value
     */
    set(key, value) {
        const expires = Date.now() + this.ttl;
        this.map.set(key, { value, expires });
    }

    /**
     * Retrieves a value for a key, if it exists and has not expired.
     * @param {any} key
     * @returns {any|undefined} The value, or undefined if not found or expired.
     */
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

    /**
     * Checks if a key exists and has not expired.
     * @param {any} key
     * @returns {boolean}
     */
    has(key) {
        return this.get(key) !== undefined;
    }

    /**
     * Deletes a key from the map.
     * @param {any} key
     * @returns {boolean}
     */
    delete(key) {
        return this.map.delete(key);
    }

    /**
     * Clears all expired entries from the map.
     */
    cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.map.entries()) {
            if (now > entry.expires) {
                this.map.delete(key);
            }
        }
    }

    /**
     * Clears all entries from the map.
     */
    clear() {
        this.map.clear();
    }

    /**
     * Returns an iterator for the map's entries.
     */
    [Symbol.iterator]() {
        this.cleanup(); // It's good practice to cleanup before iterating
        return this.map.entries();
    }

    /**
     * Returns an iterator for the map's entries.
     */
    entries() {
        this.cleanup();
        return this.map.entries();
    }

    /**
     * Returns an iterator for the map's keys.
     */
    keys() {
        this.cleanup();
        return this.map.keys();
    }

    /**
     * Returns an iterator for the map's values.
     */
    values() {
        this.cleanup();
        return this.map.values();
    }
}
