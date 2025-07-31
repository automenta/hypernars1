import { id } from '../support/utils.js';

export class ExplanationSystem {
    constructor(nar) {
        this.nar = nar;
    }

    explain(hyperedgeId, options = {}) {
        const { depth = 3, format = 'detailed', includeConfidence = true, maxAlternatives = 2 } = options;
        const path = [];
        this._traceDerivation(hyperedgeId, path, depth, new Set());

        switch (format) {
            case 'json':
                return JSON.stringify(path, null, 2);
            case 'story':
                return this._generateStoryExplanation(hyperedgeId, path);
            case 'concise':
                return this._formatConciseExplanation(path);
            case 'detailed':
            default:
                return this._formatDetailedExplanation(hyperedgeId, path, includeConfidence, maxAlternatives);
        }
    }

    _traceDerivation(hyperedgeId, path, depth, visited) {
        if (depth <= 0 || visited.has(hyperedgeId)) return;
        visited.add(hyperedgeId);

        const hyperedge = this.nar.hypergraph.get(hyperedgeId);
        if (!hyperedge) return;

        const strongestBelief = hyperedge.getStrongestBelief();
        if (!strongestBelief) return;

        // Find the most likely derivation rule and its premises
        const derivation = this._findDerivationSources(hyperedge);

        path.unshift({
            id: hyperedge.id,
            type: hyperedge.type,
            args: hyperedge.args,
            truth: strongestBelief.truth,
            derivationRule: derivation.rule,
            premises: derivation.premises.map(p => p.id)
        });

        // Recursively trace the premises
        for (const premise of derivation.premises) {
            this._traceDerivation(premise.id, path, depth - 1, visited);
        }
    }

    _findDerivationSources(hyperedge) {
        // Placeholder for a more sophisticated source-tracing mechanism.
        // For now, we'll use a simple heuristic.
        const sources = { rule: 'direct', premises: [] };

        // This is a simplified mock-up. A full implementation would check derivation caches
        // or event history to find the actual premises used in an inference step.
        if (hyperedge.type === 'Inheritance') {
            const [subject, predicate] = hyperedge.args;
            // Look for a transitive path: S -> M, M -> P
            for (const m_id of (this.nar.index.byArg.get(subject) || new Set())) {
                 const middleHyperedge = this.nar.hypergraph.get(m_id);
                 if (middleHyperedge?.type === 'Inheritance' && middleHyperedge.args[0] === subject) {
                     const middleTerm = middleHyperedge.args[1];
                     const final_id = id('Inheritance', [middleTerm, predicate]);
                     if (this.nar.hypergraph.has(final_id)) {
                         sources.rule = 'transitivity';
                         sources.premises = [middleHyperedge, this.nar.hypergraph.get(final_id)];
                         return sources;
                     }
                 }
            }
        }
        return sources;
    }

    _formatDetailedExplanation(hyperedgeId, path, includeConfidence, maxAlternatives) {
        const hyperedge = this.nar.hypergraph.get(hyperedgeId);
        if (!hyperedge) return "Hyperedge not found";

        let explanation = `CONCLUSION: ${this._formatHyperedge(hyperedge)}\n`;
        if (includeConfidence) {
            const truth = hyperedge.getTruth();
            explanation += `Confidence: ${truth.expectation().toFixed(2)} (f: ${truth.frequency.toFixed(2)}, c: ${truth.confidence.toFixed(2)})\n\n`;
        }

        explanation += "PRIMARY REASONING PATH:\n";
        path.forEach((step, i) => {
            explanation += `${i + 1}. [${step.derivationRule}] ${this._formatHyperedge(step)}\n`;
        });

        if (hyperedge.beliefs && hyperedge.beliefs.length > 1) {
            const alternatives = hyperedge.beliefs.slice(1, maxAlternatives + 1);
            if (alternatives.length > 0) {
                explanation += `\nALTERNATIVE PERSPECTIVES (${alternatives.length} of ${hyperedge.beliefs.length - 1} total):\n`;
                alternatives.forEach((alt, i) => {
                    explanation += `${i + 1}. A belief with confidence ${alt.truth.expectation().toFixed(2)} also exists.\n`;
                });
            }
        }

        const temporalContext = this.nar.temporalManager?.getContext?.();
        if (temporalContext?.currentPeriod) {
            explanation += `\nTEMPORAL CONTEXT: ${temporalContext.currentPeriod}`;
        }

        return explanation;
    }

    _formatConciseExplanation(path) {
        if (!path || path.length === 0) return "No explanation available.";
        return path.map(step => `${this._formatHyperedge(step)}`).join(' -> ');
    }

    _generateStoryExplanation(hyperedgeId, path) {
        const hyperedge = this.nar.hypergraph.get(hyperedgeId);
        if (!hyperedge) return "I don't have a story for that.";

        const conclusion = this._formatTermForStory(hyperedge);
        let story = `Let me tell you how I came to believe that ${conclusion}. `;

        if (path.length > 1) {
            const premises = path.slice(0, -1).map(p => this._formatTermForStory(p));
            if (premises.length > 0) {
                story += `It's based on a few things I know. For instance, I know that ${premises.join(' and that ')}. `;
            }
        }

        story += `From this, it is reasonable to conclude that ${conclusion}.`;
        return story;
    }

    _formatHyperedge(hyperedge) {
        if (!hyperedge) return "unknown step";
        return `${hyperedge.type}(${hyperedge.args.join(', ')})`;
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
                return `the concept of ${step.type} involving ${step.args.join(' and ')}`;
        }
    }
}
