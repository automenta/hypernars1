import { TruthValue } from './TruthValue.js';
import { Budget } from './Budget.js';

export class TimeInterval {
    constructor(id, term, start, end, options = {}) {
        this.id = id;
        this.term = term;
        this.start = start;
        this.end = end;
        this.duration = end - start;
        this.truth = options.truth || TruthValue.certain();
        this.budget = options.budget || Budget.full();
        this.relations = new Map(); // Stores relations to other intervals
    }

    relateTo(other) {
        if (this.end < other.start) return 'before';
        if (this.start > other.end) return 'after';
        if (this.end === other.start) return 'meets';
        if (this.start === other.end) return 'metBy';
        if (
            this.start < other.start &&
            this.end > other.start &&
            this.end < other.end
        )
            return 'overlaps';
        if (
            other.start < this.start &&
            other.end > this.start &&
            other.end < this.end
        )
            return 'overlappedBy';
        if (this.start > other.start && this.end < other.end) return 'during';
        if (this.start < other.start && this.end > other.end) return 'contains';
        if (this.start === other.start && this.end < other.end) return 'starts';
        if (this.start > other.start && this.end === other.end)
            return 'finishes';
        if (this.start === other.start && this.end === other.end)
            return 'equals';
        return 'unknown';
    }

    project(futureTime, decayRate = 0.05) {
        const timeDelta = Math.max(0, futureTime - this.end) / 1000; // seconds
        const decayFactor = Math.exp(-decayRate * timeDelta);
        return new TruthValue(
            this.truth.frequency,
            this.truth.confidence * decayFactor,
            this.truth.priority * decayFactor
        );
    }

    overlapsWith(otherStart, otherEnd) {
        // An interval overlaps if it starts before the other ends AND it ends after the other starts.
        return this.start < otherEnd && this.end > otherStart;
    }

    getTruth() {
        return this.truth;
    }
}
