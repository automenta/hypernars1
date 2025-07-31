export class TrieIndex {
    constructor() { this.root = {}; }
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
                return; // Word not in trie
            }
            node = node[char];
        }
        if (node._ids) {
            node._ids.delete(id);
        }
    }
}
