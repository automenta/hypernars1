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
            case 'technical':
                return this._formatTechnicalExplanation(path);
            // New formats from enhancement spec
            case 'evidence-based':
                return this._generateEvidenceBasedExplanation(hyperedgeId);
            case 'causal':
                return this._generateCausalExplanation(path);
            case 'detailed':
            default:
                return this._formatDetailedExplanation(hyperedgeId, path, includeConfidence, maxAlternatives);
        }
    }

    /**
     * Generates a justification for a belief, highlighting key evidence.
     * @param {string} hyperedgeId
     * @returns {string}
     */
    justify(hyperedgeId) {
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        if (!hyperedge) return `No information available for ${hyperedgeId}`;

        const strongestBelief = hyperedge.getStrongestBelief();
        if (!strongestBelief) return `No belief found for ${hyperedgeId}`;

        let explanation = `Belief in ${this._formatHyperedge(hyperedge)} is justified by:\n`;

        if (strongestBelief.premises && strongestBelief.premises.length > 0) {
            explanation += `\nSupporting premises:\n`;
            strongestBelief.premises.forEach((premiseId, i) => {
                const premiseEdge = this.nar.state.hypergraph.get(premiseId);
                explanation += `${i + 1}. ${this._formatHyperedge(premiseEdge)}\n`;
            });
        } else {
            explanation += `\nIt is a direct assertion (a premise).\n`;
        }

        const truth = strongestBelief.truth;
        explanation += `\nOverall confidence: ${truth.expectation().toFixed(2)} (f: ${truth.frequency.toFixed(2)}, c: ${truth.confidence.toFixed(2)})`;

        return explanation;
    }

    /**
     * Generates a counterfactual explanation.
     * @param {string} hyperedgeId - The ID of the belief to explain.
     * @param {string} alternativeId - The ID of the alternative outcome.
     * @returns {string}
     */
    counterfactual(hyperedgeId, alternativeId) {
        const originalEdge = this.nar.state.hypergraph.get(hyperedgeId);
        const alternativeEdge = this.nar.state.hypergraph.get(alternativeId);

        if (!originalEdge || !alternativeEdge) {
            return "Cannot generate counterfactual: one or both concepts not found.";
        }

        const originalPath = [];
        this._traceDerivation(hyperedgeId, originalPath, 3, new Set());
        const originalPremises = new Set(originalPath.map(p => p.id));

        let explanation = `For "${this._formatHyperedge(alternativeEdge)}" to be true instead of "${this._formatHyperedge(originalEdge)}", `;
        explanation += `the system would need to have different supporting evidence. `;
        explanation += `The current conclusion is based on premises like ${Array.from(originalPremises).map(p => `"${p}"`).join(', ')}. `;
        explanation += `A different set of initial beliefs would be required to reach the alternative conclusion.`;

        return explanation;
    }

    // --- Private Helper Methods ---

    _traceDerivation(hyperedgeId, path, depth, visited) {
        if (depth <= 0 || visited.has(hyperedgeId)) return;
        visited.add(hyperedgeId);

        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        if (!hyperedge) return;

        const strongestBelief = hyperedge.getStrongestBelief();
        if (!strongestBelief) return;

        const premises = strongestBelief.premises || [];
        const derivationRule = strongestBelief.derivedBy || this._identifyDerivationRule(hyperedge, premises);

        path.unshift({
            id: hyperedge.id,
            type: hyperedge.type,
            args: hyperedge.args,
            truth: strongestBelief.truth,
            derivationRule: derivationRule,
            premises: premises
        });

        for (const premiseId of premises) {
            this._traceDerivation(premiseId, path, depth - 1, visited);
        }
    }

    _identifyDerivationRule(conclusion, premises) {
        if (premises.length === 0) return 'assertion';

        // Simplified check for transitivity: A->B, B->C => A->C
        if (conclusion.type === 'Inheritance' && premises.length === 2) {
            const premiseEdges = premises.map(p => this.nar.state.hypergraph.get(p)).filter(Boolean);
            if (premiseEdges.length === 2 && premiseEdges.every(p => p.type === 'Inheritance')) {
                if (premiseEdges[0].args[1] === premiseEdges[1].args[0] &&
                    premiseEdges[0].args[0] === conclusion.args[0] &&
                    premiseEdges[1].args[1] === conclusion.args[1]) {
                    return 'transitivity';
                }
            }
        }

        // Simplified check for analogy: A<->B, A-->C => B-->C
        if (conclusion.type === 'Inheritance' && premises.length === 2) {
            const premiseEdges = premises.map(p => this.nar.state.hypergraph.get(p)).filter(Boolean);
            const sim = premiseEdges.find(p => p.type === 'Similarity');
            const inh = premiseEdges.find(p => p.type === 'Inheritance');
            if (sim && inh) {
                // This is a simplified check and may not cover all cases
                return 'analogy';
            }
        }

        return 'derived'; // Default for other cases
    }

    _formatDetailedExplanation(hyperedgeId, path, includeConfidence, maxAlternatives) {
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        if (!hyperedge) return "Hyperedge not found";

        let explanation = `CONCLUSION: ${this._formatHyperedge(hyperedge)}\n`;
        if (includeConfidence) {
            const truth = hyperedge.getTruth();
            explanation += `Confidence: ${truth.expectation().toFixed(2)} ` +
                `(frequency: ${truth.frequency.toFixed(2)}, ` +
                `confidence: ${truth.confidence.toFixed(2)})\n\n`;
        }

        explanation += "PRIMARY REASONING PATH:\n";
        path.forEach((step, i) => {
            explanation += `${i + 1}. [${step.derivationRule}] ${this._formatHyperedge(step)}\n`;
        });

        if (hyperedge.beliefs && hyperedge.beliefs.length > 1) {
            const alternatives = hyperedge.beliefs
                .slice(1, maxAlternatives + 1)
                .map((belief, idx) => ({
                    belief,
                    path: this._findAlternativePath(hyperedgeId, belief)
                }));

            if (alternatives.length > 0) {
                explanation += `\nALTERNATIVE PERSPECTIVES (${alternatives.length} of ${hyperedge.beliefs.length - 1}):\n`;
                alternatives.forEach((alt, i) => {
                    explanation += `${i + 1}. Based on different evidence:\n`;
                    explanation += `   Confidence: ${alt.belief.truth.expectation().toFixed(2)}\n`;
                    if (alt.path && alt.path.length > 0) {
                        explanation += `   Reasoning path: ${alt.path.map(s => this._formatHyperedge(s)).join(' → ')}\n`;
                    }
                });
            }
        }

        const temporalContext = this.nar.temporalManager.getContext();
        if (temporalContext.currentPeriod) {
            explanation += `\nTEMPORAL CONTEXT: ${temporalContext.currentPeriod}`;
            if (temporalContext.season) explanation += `, ${temporalContext.season}`;
        }

        return explanation;
    }

    _formatTechnicalExplanation(path) {
        if (!path || path.length === 0) return "No technical explanation available.";
        let explanation = "TECHNICAL REASONING TRACE:\n";
        path.forEach((step, i) => {
            explanation += `Step ${i + 1}:\n`;
            explanation += `  ID: ${step.id}\n`;
            explanation += `  Type: ${step.type}\n`;
            explanation += `  Truth: { f: ${step.truth.frequency.toFixed(3)}, c: ${step.truth.confidence.toFixed(3)} }\n`;
            explanation += `  DerivedBy: ${step.derivationRule}\n`;
            explanation += `  Premises: ${step.premises.join(', ') || 'N/A'}\n\n`;
        });
        return explanation;
    }

    _findAlternativePath(hyperedgeId, belief) {
        // Placeholder implementation. A real implementation would need to
        // trace the derivation path for a specific belief, which is complex.
        const path = [];
        if (belief.premises && belief.premises.length > 0) {
            this._traceDerivation(belief.premises[0], path, 2, new Set());
        }
        return path;
    }

    _generateEvidenceBasedExplanation(hyperedgeId) {
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        if (!hyperedge) return "No evidence found: concept does not exist.";

        let explanation = `Evidence report for ${this._formatHyperedge(hyperedge)}:\n`;
        hyperedge.beliefs.forEach((belief, i) => {
            explanation += `\nBelief ${i+1}: Expectation ${belief.truth.expectation().toFixed(2)}\n`;
            explanation += `  - Source: ${belief.derivedBy || 'assertion'}\n`;
            if (belief.premises && belief.premises.length > 0) {
                explanation += `  - Premises: ${belief.premises.join(', ')}\n`;
            }
        });
        return explanation;
    }

    _generateCausalExplanation(path) {
        if (!path || path.length === 0) return "No causal path found.";
        // This is a simplified causal explanation, treating implication as causality.
        const implications = path.filter(step => step.type === 'Implication');
        if (implications.length === 0) {
            return "The reasoning path does not contain clear causal (implication) steps.";
        }
        const causes = implications.map(step => this._formatHyperedge(step.args[0]));
        const effects = implications.map(step => this._formatHyperedge(step.args[1]));
        return `The conclusion is reached because ${causes.join(' and ')} are believed to cause ${effects.join(' and ')}.`;
    }

    _formatConciseExplanation(path) {
        if (!path || path.length === 0) return "No explanation available.";
        return path.map(step => this._formatHyperedge(step)).join(' -> ');
    }

    _generateStoryExplanation(hyperedgeId, path) {
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
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

        // If an argument is a complex object from parsing, format it recursively
        const formatArg = (arg) => {
            if (typeof arg === 'string') return arg;
            if (arg && arg.type && arg.args) return this._formatHyperedge(arg);
            return JSON.stringify(arg);
        };

        const args = hyperedge.args ? hyperedge.args.map(formatArg).join(', ') : '';

        switch(hyperedge.type) {
            case 'TemporalRelation':
                const term1 = hyperedge.args[0].split('(')[0];
                const term2 = hyperedge.args[1].split('(')[0];
                const relation = hyperedge.args[2];
                return `${term1} ${relation} ${term2}`;
            case 'TimeInterval':
                return `TimeInterval for ${hyperedge.args[0]}`;
            default:
                return `${hyperedge.type}(${args})`;
        }
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
