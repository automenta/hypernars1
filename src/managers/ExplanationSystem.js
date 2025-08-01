/**
 * An enhanced explanation system that combines the multi-format capabilities
 * of the existing system with the structured templating and confidence
 * reporting from the enhancement proposals (`enhance.b.md`, `enhance.f.md`).
 */
export class ExplanationSystem {
    constructor(nar) {
        this.nar = nar;
        this.explanationTemplates = {
            'assertion': "It is a direct assertion that {conclusion}.",
            'transitivity': "Because {premise1} and {premise2}, it follows through transitivity that {conclusion}.",
            'analogy': "By analogy, since {premise1} and {premise2}, it is likely that {conclusion}.",
            'induction': "Observing that {premise1} and {premise2} are related, we can induce that {conclusion}.",
            'derived': "From the premise {premise1}, it was derived that {conclusion}.",
            'default': "It is believed that {conclusion}, based on the premise {premise1}.",
        };
    }

    /**
     * Main entry point for generating explanations.
     * @param {string} hyperedgeId - The ID of the concept to explain.
     * @param {Object} [options] - Configuration for the explanation.
     * @param {number} [options.depth=3] - How deep to trace the derivation.
     * @param {string} [options.format='detailed'] - The desired format ('detailed', 'concise', 'json', 'story', 'technical').
     * @returns {string|Object} The formatted explanation.
     */
    explain(hyperedgeId, options = {}) {
        const { depth = 3, format = 'detailed', perspective = 'evidential' } = options;

        if (format === 'justification') {
            return this._formatJustification(hyperedgeId);
        }

        if (perspective === 'counterfactual') {
            return this._formatCounterfactualExplanation(hyperedgeId, options);
        }

        const path = [];
        this._traceDerivation(hyperedgeId, path, depth, new Set());

        if (path.length === 0) {
            return `No derivation path found for ${hyperedgeId}. It might be a base premise.`;
        }

        // Handle perspective-based formatting first
        if (perspective === 'causal') {
            return this._formatCausalExplanation(path);
        }
        // 'evidential' is the default and will be handled by the format switch

        switch (format) {
            case 'json':
                return JSON.stringify(path, null, 2);
            case 'visual':
                return this._formatVisualExplanation(path);
            case 'story':
                return this._generateStoryExplanation(path);
            case 'concise':
                return path.map(step => this._formatHyperedge(step)).join(' -> ');
            case 'technical':
                return this._formatTechnicalExplanation(path);
            case 'detailed':
            default:
                return this._formatDetailedExplanation(hyperedgeId, path, options);
        }
    }

    _formatCausalExplanation(path) {
        let explanation = "The belief that ";
        const conclusion = path[path.length - 1];
        explanation += `${this._formatHyperedge(conclusion)} is held with confidence ${this._formatConfidence(conclusion.truth.confidence)}. This is caused by the following chain of reasoning:\n`;
        path.slice().reverse().forEach((step, i) => {
            explanation += `${'  '.repeat(i)}-> Because of the belief that ${this._formatHyperedge(step)}.\n`;
        });
        return explanation;
    }

    _formatCounterfactualExplanation(hyperedgeId, options) {
        const { alternative } = options;
        if (!alternative) {
            return "Counterfactual explanation requires an 'alternative' premise to be provided in options.";
        }

        const path = [];
        this._traceDerivation(hyperedgeId, path, options.depth || 3, new Set());
        if (path.length === 0) {
            return "Cannot generate counterfactual: no derivation path found for the original belief.";
        }

        const originalPremise = path[0];
        const sandbox = this.nar.createSandbox();

        // Remove the original premise and insert the alternative
        sandbox.api.removeHyperedge(originalPremise.id);
        sandbox.api.nal(alternative, { truth: originalPremise.truth }); // Use same truth for a fair comparison

        // Run the sandbox to see what happens
        sandbox.run(50); // Run for a limited number of steps

        // Check if the original conclusion still holds
        const conclusionInSandbox = sandbox.api.getBeliefs(hyperedgeId);

        let explanation = `Counterfactual analysis for: ${this._formatHyperedge(this.nar.state.hypergraph.get(hyperedgeId))}\n`;
        explanation += `If we assume "${alternative}" instead of "${this._formatHyperedge(originalPremise)}":\n`;

        if (conclusionInSandbox.length > 0) {
            const newTruth = conclusionInSandbox[0].truth;
            explanation += `The conclusion still holds, but its confidence changes to ${this._formatConfidence(newTruth.confidence)}.`;
        } else {
            explanation += "The original conclusion no longer holds.";
            // A more advanced version would explain what new conclusions are reached instead.
        }

        return explanation;
    }

    /**
     * Generates a justification for a belief, highlighting key supporting and conflicting evidence.
     * Based on the proposal in `enhance.b.md`.
     * @param {string} hyperedgeId - The ID of the concept to justify.
     * @returns {string} The formatted justification.
     */
    _formatJustification(hyperedgeId) {
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        if (!hyperedge) return `No information available for ${hyperedgeId}`;

        const strongestBelief = hyperedge.getStrongestBelief();
        if (!strongestBelief) return `No belief found for ${hyperedgeId}`;

        let explanation = `Justification for: ${this._formatHyperedge(hyperedge)}\n`;
        explanation += `Overall Confidence: ${this._formatConfidence(strongestBelief.truth.confidence)} (f: ${strongestBelief.truth.frequency.toFixed(2)})\n\n`;

        // 1. Find supporting evidence from its derivation path
        const derivationPath = [];
        this._traceDerivation(hyperedgeId, derivationPath, 3, new Set());
        const supportingPremises = derivationPath.slice(0, -1);

        if (supportingPremises.length > 0) {
            explanation += "Supporting Evidence (from derivation):\n";
            supportingPremises.forEach(premise => {
                explanation += `  - Because of: ${this._formatHyperedge(premise)} (Confidence: ${this._formatConfidence(premise.truth.confidence)})\n`;
            });
        } else {
            explanation += "Supporting Evidence: This appears to be a base assertion.\n";
        }

        // 2. Find conflicting evidence (other beliefs on the same hyperedge)
        const conflictingBeliefs = hyperedge.beliefs.filter(b => b !== strongestBelief);
        if (conflictingBeliefs.length > 0) {
            explanation += "\nConflicting Evidence (overridden or merged):\n";
            conflictingBeliefs.forEach(belief => {
                explanation += `  - An alternative belief exists with confidence ${this._formatConfidence(belief.truth.confidence)} (f: ${belief.truth.frequency.toFixed(2)})\n`;
            });
        }

        // 3. Mention if it was part of a resolved contradiction
        const contradiction = this.nar.contradictionManager.contradictions.get(hyperedgeId);
        if (contradiction && contradiction.resolved) {
            explanation += `\nNote: This belief was part of a contradiction resolved via the '${contradiction.resolutionStrategy}' strategy.\n`;
        }

        return explanation;
    }

    _formatVisualExplanation(path) {
        const nodes = path.map((step, i) => ({
            id: step.id,
            label: `${step.type}(${step.args.slice(0, 2).join(',')}${step.args.length > 2 ? ',...' : ''})`,
            level: i,
            truth: step.truth
        }));

        const edges = [];
        path.forEach(step => {
            if (step.premises) {
                step.premises.forEach(premiseId => {
                    if (path.some(p => p.id === premiseId)) { // Only draw edges to nodes in the current path
                        edges.push({ from: premiseId, to: step.id, label: step.derivationRule });
                    }
                });
            }
        });

        return { nodes, edges };
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
        const derivationRule = strongestBelief.derivedBy || 'assertion';

        // Add current step to the front of the path
        path.unshift({
            id: hyperedge.id,
            type: hyperedge.type,
            args: hyperedge.args,
            truth: strongestBelief.truth,
            derivationRule,
            premises
        });

        // Recurse on the first premise to build a linear path for simplicity
        if (premises.length > 0) {
            this._traceDerivation(premises[0], path, depth - 1, visited);
        }
    }

    _formatDetailedExplanation(hyperedgeId, path, options) {
        const { includeConfidence = true, maxAlternatives = 2 } = options;
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        if (!hyperedge) return "Hyperedge not found";

        const conclusion = path[path.length - 1];
        let explanation = `CONCLUSION: ${this._formatHyperedge(conclusion)}\n`;

        if (includeConfidence) {
            explanation += `Confidence: ${this._formatConfidence(conclusion.truth.confidence)}\n\n`;
        }

        explanation += "PRIMARY REASONING PATH:\n";
        path.forEach((step, i) => {
            const rule = step.derivationRule || 'assertion';
            const template = this.explanationTemplates[rule] || this.explanationTemplates['default'];

            const premise1 = step.premises?.[0] ? this._formatHyperedge(this.nar.state.hypergraph.get(step.premises[0])) : 'a previous belief';
            const premise2 = step.premises?.[1] ? this._formatHyperedge(this.nar.state.hypergraph.get(step.premises[1])) : 'another belief';

            const formattedStep = template
                .replace('{conclusion}', this._formatHyperedge(step))
                .replace('{premise1}', premise1)
                .replace('{premise2}', premise2);

            explanation += `${i + 1}. ${formattedStep}\n`;
        });

        // Add alternative perspectives / contradictions
        if (hyperedge.beliefs.length > 1) {
            const alternatives = hyperedge.beliefs
                .slice(1, maxAlternatives + 1)
                .map(belief => ({
                    truth: belief.truth,
                    path: this._findAlternativePath(hyperedgeId, belief) // Placeholder
                }));

            if (alternatives.length > 0) {
                explanation += `\nALTERNATIVE PERSPECTIVES (${alternatives.length} of ${hyperedge.beliefs.length - 1} total):\n`;
                alternatives.forEach((alt, i) => {
                    explanation += `${i + 1}. A belief with confidence ${this._formatConfidence(alt.truth.confidence)} also exists.\n`;
                    if (alt.path && alt.path.length > 0) {
                        explanation += `   Reasoning: ${alt.path.map(s => this._formatHyperedge(s)).join(' → ')}\n`;
                    }
                });
            }
        }

        const contradiction = this.nar.contradictionManager.contradictions.get(hyperedgeId);
        if (contradiction && contradiction.resolved) {
            explanation += `\nNOTE: This belief was part of a contradiction that was resolved using the '${contradiction.resolutionStrategy}' strategy.\n`;
        }

        return explanation;
    }

    _findAlternativePath(hyperedgeId, belief) {
        // Placeholder implementation for finding an alternative derivation path.
        // A real implementation would require a more sophisticated tracing mechanism.
        if (belief.premises && belief.premises.length > 0) {
            const path = [];
            this._traceDerivation(belief.premises[0], path, 2, new Set());
            return path;
        }
        return [];
    }

    _formatTechnicalExplanation(path) {
        return path.map((step, i) =>
            `Step ${i + 1}: [${step.id}] ${step.type}(${step.args.join(', ')}) | ` +
            `Truth(f: ${step.truth.frequency.toFixed(2)}, c: ${step.truth.confidence.toFixed(2)}) | ` +
            `Rule: ${step.derivationRule} | Premises: [${step.premises.join(', ')}]`
        ).join('\n');
    }

    _generateStoryExplanation(path) {
        if (!path || path.length === 0) return "I don't have a story for that.";
        const conclusion = path[path.length - 1];

        let story = `Let me tell you how I came to believe that ${this._formatTermForStory(conclusion)}. `;
        if (path.length > 1) {
            const premises = path.slice(0, -1).map(p => this._formatTermForStory(p));
            story += `It's based on a few things I know. For instance, I know that ${premises.join(' and that ')}. `;
        }
        story += `From this, it is reasonable to conclude that ${this._formatTermForStory(conclusion)}.`;
        return story;
    }

    _formatHyperedge(hyperedge) {
        if (!hyperedge) return "an unknown concept";
        const args = hyperedge.args ? hyperedge.args.join(', ') : '';
        return `${hyperedge.type}(${args})`;
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

    _formatConfidence(confidence) {
        if (confidence >= 0.9) return `Very High (${(confidence * 100).toFixed(0)}%)`;
        if (confidence >= 0.75) return `High (${(confidence * 100).toFixed(0)}%)`;
        if (confidence >= 0.5) return `Moderate (${(confidence * 100).toFixed(0)}%)`;
        if (confidence >= 0.25) return `Low (${(confidence * 100).toFixed(0)}%)`;
        return `Very Low (${(confidence * 100).toFixed(0)}%)`;
    }
}
