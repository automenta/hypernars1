class PatternTracker {
    constructor() {
        this.patterns = new Map();
    }

    recordPattern(hyperedgeId, activeNeighbors, activation, priority) {
        const patternKey = [...activeNeighbors].sort().join('|');
        if (!this.patterns.has(patternKey)) {
            this.patterns.set(patternKey, {
                terms: activeNeighbors,
                support: 0,
                totalActivation: 0,
                totalPriority: 0,
                occurrences: 0,
            });
        }

        const pattern = this.patterns.get(patternKey);
        pattern.support++;
        pattern.totalActivation += activation;
        pattern.totalPriority += priority;
        pattern.occurrences++;
    }

    getFrequentPatterns(minSupport) {
        return Array.from(this.patterns.values()).filter(
            (p) => p.support >= minSupport
        );
    }

    getPatternTruth(pattern) {
        const frequency = pattern.support / pattern.occurrences;
        const confidence = pattern.totalPriority / pattern.occurrences;
        return { frequency, confidence };
    }
}

export { PatternTracker };
