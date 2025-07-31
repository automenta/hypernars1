import { id } from '../support/utils.js';

export class ExplanationSystem {
    constructor(nar) {
        this.nar = nar;
    }

    explain(hyperedgeId, options = {}) {
        const { depth = 3, format = 'detailed' } = options;
        const path = [];
        this._traceDerivation(hyperedgeId, path, depth);

        if (format === 'json') {
            return JSON.stringify(path, null, 2);
        }
        if (format === 'story') {
            return this._generateStoryExplanation(path);
        }
        return this._formatDetailedExplanation(path);
    }

    _traceDerivation(hyperedgeId, path, depth) {
        if (depth <= 0) return;

        const hyperedge = this.nar.hypergraph.get(hyperedgeId);
        if (!hyperedge) return;

        path.push({
            id: hyperedge.id,
            type: hyperedge.type,
            args: hyperedge.args,
            truth: hyperedge.getTruth()
        });

        // Find potential derivation sources
        if (hyperedge.type === 'Inheritance') {
            const [subject, predicate] = hyperedge.args;

            // Check for transitive derivation
            (this.nar.index.byArg.get(predicate) || new Set()).forEach(id => {
                const middle = this.nar.hypergraph.get(id);
                if (middle?.type === 'Inheritance' && middle.args[1] === subject) {
                    this._traceDerivation(middle.id, path, depth - 1);
                    return;
                }
            });

            // Check for similarity conversion
            if (this.nar.hypergraph.has(id('Similarity', [predicate, subject]))) {
                this._traceDerivation(id('Similarity', [predicate, subject]), path, depth - 1);
            }

            // Check for induction source
            (this.nar.index.byArg.get(predicate) || new Set()).forEach(id => {
                const other = this.nar.hypergraph.get(id);
                if (other?.type === 'Inheritance' && other.args[1] === predicate && other.args[0] !== subject) {
                    this._traceDerivation(other.id, path, depth - 1);
                    return;
                }
            });
        }
    }

    _formatDetailedExplanation(path) {
        if (!path || path.length === 0) return "No derivation path found.";
        return path.map((step, i) =>
          `${'  '.repeat(i)}-> ${step.type}(${step.args.join(',')}) [f:${step.truth.frequency.toFixed(2)}, c:${step.truth.confidence.toFixed(2)}]`
        ).join('\\n');
    }

    _generateStoryExplanation(path) {
        if (!path || path.length === 0) return "I don't have a story for that.";

        const conclusion = this._formatTermForStory(path[0]);
        let story = `Let me tell you how I came to believe that ${conclusion}. `;

        if (path.length > 1) {
            story += "It's based on a few things. ";
            const premises = path.slice(1).map(p => this._formatTermForStory(p)).join(', and ');
            story += `I know that ${premises}. `;
        }

        story += `Therefore, it is reasonable to conclude that ${conclusion}.`;
        return story;
    }

    _formatTermForStory(step) {
        if (!step) return "something";
        switch (step.type) {
            case 'Inheritance':
                return `${step.args[0]} is a kind of ${step.args[1]}`;
            case 'Similarity':
                return `${step.args[0]} is similar to ${step.args[1]}`;
            case 'Implication':
                return `if ${step.args[0]}, then ${step.args[1]}`;
            default:
                return `${step.type} of ${step.args.join(' and ')}`;
        }
    }
}
