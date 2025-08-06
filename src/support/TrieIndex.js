export class TrieIndex {
    constructor() {
        this.root = {};
    }

    add(word, id) {
        let node = this.root;
        for (const char of word) {
            if (!node[char]) {
                node[char] = {};
            }
            node = node[char];
        }
        if (!node._ids) {
            node._ids = new Set();
        }
        node._ids.add(id);
    }

    get(word) {
        let node = this.root;
        for (const char of word) {
            if (!node[char]) {
                return new Set();
            }
            node = node[char];
        }
        return node._ids || new Set();
    }

    remove(word, id) {
        let node = this.root;
        for (const char of word) {
            if (!node[char]) {
                return;
            }
            node = node[char];
        }
        if (node._ids) {
            node._ids.delete(id);
        }
    }

    search(prefix) {
        let node = this.root;
        for (const char of prefix) {
            if (!node[char]) {
                return new Set();
            }
            node = node[char];
        }

        const results = new Set();
        this._collectAllWords(node, prefix, results);
        return results;
    }

    _collectAllWords(node, currentWord, results) {
        if (node._ids) {
            results.add(currentWord);
        }

        for (const char in node) {
            if (char !== '_ids') {
                this._collectAllWords(node[char], currentWord + char, results);
            }
        }
    }
}
