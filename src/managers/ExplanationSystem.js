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
                return JSON.stringify(path[0], null, 2); // Return the whole tree
            case 'visual':
                return this._formatVisualExplanation(path[0]);
            case 'story':
                return this._generateStoryExplanation(path[0]);
            case 'concise':
                const flatPath = [];
                this._flattenTree(path[0], flatPath);
                return flatPath.map(step => this._formatHyperedge(step)).join(' -> ');
            case 'technical':
                return this._formatTechnicalExplanation(path[0]);
            case 'detailed':
            default:
                return this._formatDetailedExplanation(hyperedgeId, path, options);
        }
    }

    /**
     * Generates a justification for a belief, highlighting key evidence.
     * This is a direct entry point for the justification format.
     * @param {string} hyperedgeId - The ID of the concept to justify.
     * @returns {string} The formatted justification.
     */
    justify(hyperedgeId) {
        return this.explain(hyperedgeId, { format: 'justification' });
    }

    /**
     * Generates a counterfactual explanation.
     * This is a direct entry point for the counterfactual perspective.
     * @param {string} hyperedgeId - The ID of the original concept.
     * @param {Object} options - Must include an 'alternative' premise.
     * @returns {string} The formatted counterfactual explanation.
     */
    counterfactual(hyperedgeId, options) {
        return this.explain(hyperedgeId, { ...options, perspective: 'counterfactual' });
    }

    _formatCausalExplanation(path) {
        let explanation = "The belief that ";
        const conclusion = path[path.length - 1];
        explanation += `${this._formatHyperedge(conclusion)} is held with confidence ${this._formatConfidence(conclusion.truth)}. This is caused by the following chain of reasoning:\n`;
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
        
        const originalHyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        if (!originalHyperedge) {
            return "Cannot generate counterfactual: original belief not found.";
        }

        let premiseToReplace;
        if (path.length > 0 && path[0].premises.length > 0) {
            // Find the ID of the most fundamental premise in the derivation path
            const premiseId = path[0].premises[0].id;
            premiseToReplace = this.nar.state.hypergraph.get(premiseId);
        } else {
            // If no derivation or it's a direct assertion, the hyperedge itself is the premise
            premiseToReplace = originalHyperedge;
        }

        if (!premiseToReplace) {
            return `Could not determine a premise to replace for counterfactual analysis of ${hyperedgeId}.`;
        }

        const sandbox = this.nar.createSandbox();

        // Remove the original premise and insert the alternative
        sandbox.api.removeHyperedge(premiseToReplace.id);
        // Use the same truth value for a fair comparison
        const truthValue = premiseToReplace.getStrongestBelief()?.truth || { frequency: 1.0, confidence: 0.9 };
        sandbox.api.nal(alternative, { truth: truthValue });

        // Run the sandbox to see what happens
        sandbox.run(50); // Run for a limited number of steps

        // Check if the original conclusion still holds
        const conclusionInSandbox = sandbox.api.getBeliefs(hyperedgeId);

        let explanation = `Counterfactual analysis for: ${this._formatHyperedge(originalHyperedge)}\n`;
        explanation += `If we assume "${alternative}" instead of "${this._formatHyperedgeSimple(premiseToReplace)}":\n`;

        if (conclusionInSandbox.length > 0) {
            const newTruth = conclusionInSandbox[0].truth;
            explanation += `The conclusion still holds, but its confidence changes to ${this._formatConfidence(newTruth)}.`;
        } else {
            explanation += "The original conclusion no longer holds.\n";

            // Find the most prominent new conclusions, looking for the specific one if provided.
            const newConclusions = Array.from(sandbox.state.hypergraph.values())
                .filter(h => h.getTruthExpectation() > 0.6 && h.id !== hyperedgeId && !h.id.startsWith('Question'))
                .sort((a, b) => b.getTruthExpectation() - a.getTruthExpectation());

            const specificConclusionId = options.specificConclusion;
            const specificConclusion = specificConclusionId ? newConclusions.find(c => c.id === specificConclusionId) : null;

            const otherProminent = newConclusions
                .filter(c => c.id !== specificConclusionId)
                .slice(0, specificConclusion ? 4 : 5);

            const finalConclusions = specificConclusion ? [specificConclusion, ...otherProminent] : otherProminent;

            if (finalConclusions.length > 0) {
                explanation += "Instead, the following new conclusions are now prominent:\n";
                finalConclusions.forEach(c => {
                    explanation += `  - ${this._formatHyperedge(c)} (Confidence: ${this._formatConfidence(c.getTruth())})\n`;
                });
            } else {
                explanation += "No prominent alternative conclusions were reached in the simulation.";
            }
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
        explanation += `Overall Confidence: ${this._formatConfidence(strongestBelief.truth)} (f: ${strongestBelief.truth.frequency.toFixed(2)})\n\n`;

        // 1. Find supporting evidence from its derivation path
        const derivationPath = [];
        this._traceDerivation(hyperedgeId, derivationPath, 3, new Set());
        const supportingPremises = derivationPath.slice(0, -1);

        if (supportingPremises.length > 0) {
            explanation += "Supporting Evidence (from derivation):\n";
            supportingPremises.forEach(premise => {
                explanation += `  - Because of: ${this._formatHyperedge(premise)} (Confidence: ${this._formatConfidence(premise.truth)})\n`;
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

    _flattenTree(node, flatPath) {
        if (!node) return;
        flatPath.push(node);
        if (node.premises) {
            node.premises.forEach(p => this._flattenTree(p, flatPath));
        }
    }

    _formatVisualExplanation(rootNode) {
        const nodes = [];
        const edges = [];
        const queue = [rootNode];
        const visited = new Set();

        while(queue.length > 0) {
            const node = queue.shift();
            if (visited.has(node.id)) continue;
            visited.add(node.id);

            nodes.push({
                id: node.id,
                label: `${node.type}(${node.args.slice(0, 2).join(',')}${node.args.length > 2 ? ',...' : ''})`,
                truth: node.truth
            });

            if (node.premises) {
                node.premises.forEach(premise => {
                    edges.push({ from: premise.id, to: node.id, label: node.derivationRule });
                    queue.push(premise);
                });
            }
        }
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

        const premiseIds = strongestBelief.premises || [];
        const derivationRule = strongestBelief.derivedBy || 'assertion';

        const premiseNodes = [];
        if (premiseIds.length > 0) {
            for (const premiseId of premiseIds) {
                const premisePath = [];
                this._traceDerivation(premiseId, premisePath, depth - 1, visited);
                if (premisePath.length > 0) {
                    premiseNodes.push(premisePath[0]); // Get the root of the sub-tree
                }
            }
        }

        path.unshift({
            id: hyperedge.id,
            type: hyperedge.type,
            args: hyperedge.args,
            truth: strongestBelief.truth,
            derivationRule,
            premises: premiseNodes // Store the fully formed premise nodes
        });
    }

    _formatDetailedExplanation(hyperedgeId, path, options) {
        const { includeConfidence = true, maxAlternatives = 2 } = options;
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        if (!hyperedge) return "Hyperedge not found";

        const conclusion = path[0]; // Path is now conclusion-first
        let explanation = `CONCLUSION: ${this._formatHyperedge(conclusion)}\n`;

        if (includeConfidence) {
            explanation += `Confidence: ${this._formatConfidence(conclusion.truth)}\n\n`;
        }

        explanation += "REASONING PATH:\n";
        explanation += this._formatExplanationTree(conclusion, 0);


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
                    explanation += `${i + 1}. A belief with confidence ${this._formatConfidence(alt.truth)} also exists.\n`;
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

        // Add temporal context if relevant, as per enhance.a.md
        const temporalContext = this.nar.temporalManager.getContext();
        if (temporalContext && temporalContext.currentPeriod) {
            explanation += `\nTEMPORAL CONTEXT: The reasoning occurred during the ${temporalContext.currentPeriod} in the ${temporalContext.season}.\n`;
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

    _formatExplanationTree(node, level) {
        const indent = '  '.repeat(level);
        const rule = node.derivationRule || 'assertion';
        const template = this.explanationTemplates[rule] || this.explanationTemplates['default'];

        const premise1 = node.premises?.[0] ? this._formatHyperedge(node.premises[0]) : 'a previous belief';
        const premise2 = node.premises?.[1] ? this._formatHyperedge(node.premises[1]) : 'another belief';

        let formattedStep = template
            .replace('{conclusion}', this._formatHyperedge(node))
            .replace('{premise1}', premise1)
            .replace('{premise2}', premise2);

        let output = `${indent}- ${formattedStep} (Confidence: ${this._formatConfidence(node.truth)})\n`;

        if (node.premises && node.premises.length > 0) {
            node.premises.forEach(premiseNode => {
                output += this._formatExplanationTree(premiseNode, level + 1);
            });
        }

        return output;
    }

    _formatTechnicalExplanation(rootNode) {
        const flatPath = [];
        this._flattenTree(rootNode, flatPath);
        return flatPath.map((step, i) =>
            `Step ${i + 1}: [${step.id}] ${step.type}(${step.args.join(', ')}) | ` +
            `Truth(f: ${step.truth.frequency.toFixed(2)}, c: ${step.truth.confidence.toFixed(2)}, d: ${(step.truth.doubt || 0).toFixed(2)}) | ` +
            `Rule: ${step.derivationRule} | Premises: [${step.premises.map(p => p.id).join(', ')}]`
        ).join('\n');
    }

    _generateStoryExplanation(rootNode) {
        if (!rootNode) return "I don't have a story for that.";
        const conclusion = rootNode;

        let story = `Let me tell you how I came to believe that ${this._formatTermForStory(conclusion)}. `;
        if (conclusion.premises && conclusion.premises.length > 0) {
            const premises = conclusion.premises.map(p => this._formatTermForStory(p));
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

    /**
     * A simpler formatter for hyperedges that avoids verbose Term() wrappers.
     * Used for creating cleaner output in certain explanation formats.
     */
    _formatHyperedgeSimple(hyperedge) {
        if (!hyperedge) return "an unknown concept";
        // This regex removes the "Term(...)" wrapper for cleaner output.
        const args = hyperedge.args ? hyperedge.args.map(arg => arg.replace(/Term\((.*?)\)/g, '$1')).join(', ') : '';
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

    _formatConfidence(truth) {
        const confidence = truth.confidence;
        const doubt = truth.doubt || 0;
        let description;

        if (confidence >= 0.9) description = `Very High (${(confidence * 100).toFixed(0)}%)`;
        else if (confidence >= 0.75) description = `High (${(confidence * 100).toFixed(0)}%)`;
        else if (confidence >= 0.5) description = `Moderate (${(confidence * 100).toFixed(0)}%)`;
        else if (confidence >= 0.25) description = `Low (${(confidence * 100).toFixed(0)}%)`;
        else description = `Very Low (${(confidence * 100).toFixed(0)}%)`;

        if (doubt > 0.6) description += " (significant doubt)";
        else if (doubt > 0.3) description += " (some doubt)";

        return description;
    }
}
