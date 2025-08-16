export class ExplanationSystem {
    constructor(nar, config) {
        this.nar = nar;
        this.config = config;
        this.explanationTemplates = {
            'assertion': "It is a direct assertion that {conclusion}.",
            'transitivity': "Because {premise1} and {premise2}, it follows through transitivity that {conclusion}.",
            'analogy': "By analogy, since {premise1} and {premise2}, it is likely that {conclusion}.",
            'induction': "Observing that {premise1} and {premise2} are related, we can induce that {conclusion}.",
            'derived': "From the premise {premise1}, it was derived that {conclusion}.",
            'default': "It is believed that {conclusion}, based on the premise {premise1}.",
        };
    }

    explain(hyperedgeId, options = {}) {
        const {depth = 3, format = 'detailed', perspective = 'evidential'} = options;

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

        if (perspective === 'causal') {
            return this._formatCausalExplanation(path);
        }

        return this._formatByTarget(format, hyperedgeId, path, options);
    }

    _formatByTarget(format, hyperedgeId, path, options) {
        switch (format) {
            case 'json':
                return JSON.stringify(path[0], null, 2);
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

    _formatCausalExplanation(path) {
        const conclusion = path[path.length - 1];
        const initialStatement = `The belief that ${this._formatHyperedge(conclusion)} is held with confidence ${this._formatConfidence(conclusion.truth)}. This is caused by the following chain of reasoning:`;
        const reasoningChain = path.slice().reverse().map((step, i) => `${'  '.repeat(i)}-> Because of the belief that ${this._formatHyperedge(step)}.`);
        return [initialStatement, ...reasoningChain].join('\n');
    }

    _formatCounterfactualExplanation(hyperedgeId, options) {
        const {alternative} = options;
        if (!alternative) {
            return "Counterfactual explanation requires an 'alternative' premise to be provided in options.";
        }

        const originalHyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        if (!originalHyperedge) {
            return "Cannot generate counterfactual: original belief not found.";
        }

        const premiseToReplace = this._findPremiseToReplace(hyperedgeId, options.depth);
        if (!premiseToReplace) {
            return `Could not determine a premise to replace for counterfactual analysis of ${hyperedgeId}.`;
        }

        const sandbox = this._runCounterfactualSandbox(premiseToReplace, alternative);
        return this._analyzeCounterfactualResults(originalHyperedge, sandbox, alternative, premiseToReplace);
    }

    _findPremiseToReplace(hyperedgeId, depth = 3) {
        const path = [];
        this._traceDerivation(hyperedgeId, path, depth, new Set());
        return (path.length > 0 && path[0].premises.length > 0)
            ? this.nar.state.hypergraph.get(path[0].premises[0].id)
            : this.nar.state.hypergraph.get(hyperedgeId);
    }

    _runCounterfactualSandbox(premiseToReplace, alternative) {
        const sandbox = this.nar.createSandbox({minConfidence: 0.3});
        sandbox.api.removeHyperedge(premiseToReplace.id);
        const truthValue = premiseToReplace.getStrongestBelief()?.truth || {frequency: 1.0, confidence: 0.9};
        sandbox.api.nal(alternative, {truth: truthValue});
        sandbox.run(100);
        return sandbox;
    }

    _analyzeCounterfactualResults(originalHyperedge, sandbox, alternative, premiseToReplace) {
        const conclusionInSandbox = sandbox.api.getBeliefs(originalHyperedge.id);
        const explanation = [
            `Counterfactual analysis for: ${this._formatHyperedge(originalHyperedge)}`,
            `If we were to assume "${alternative}" instead of "${this._formatHyperedgeSimple(premiseToReplace)}", the consequences would be:\n`
        ];

        if (conclusionInSandbox.length > 0) {
            const newTruth = conclusionInSandbox[0].truth;
            explanation.push(`1.  The original conclusion **still holds**, but its confidence would change to ${this._formatConfidence(newTruth)}.`);
        } else {
            explanation.push(`1.  The original conclusion **no longer holds**.`);
        }

        const newConclusions = this._findNewConclusions(sandbox, new Set([...this.nar.state.hypergraph.keys()]), premiseToReplace.id, alternative);
        if (newConclusions.length > 0) {
            explanation.push(`2.  The following **new conclusions** would become prominent:`);
            newConclusions.forEach(c => {
                explanation.push(`    - ${this._formatHyperedge(c)} (Confidence: ${this._formatConfidence(c.getTruth())})`);
            });
        } else {
            explanation.push("2.  No other significant new conclusions would be reached in the simulation.");
        }

        return explanation.join('\n');
    }

    _findNewConclusions(sandbox, originalBeliefIds, replacedPremiseId, alternative) {
        return Array.from(sandbox.state.hypergraph.values())
            .filter(h =>
                !originalBeliefIds.has(h.id) &&
                h.getTruthExpectation() > 0.6 &&
                h.type !== 'Term' &&
                h.id !== replacedPremiseId &&
                !h.id.includes(alternative)
            )
            .sort((a, b) => b.getTruthExpectation() - a.getTruthExpectation())
            .slice(0, 3);
    }

    _formatJustification(hyperedgeId) {
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        if (!hyperedge) {
            return `No information available for ${hyperedgeId}`;
        }

        const strongestBelief = hyperedge.getStrongestBelief();
        if (!strongestBelief) {
            return `No belief found for ${hyperedgeId}`;
        }

        const explanation = [
            `Justification for: ${this._formatHyperedge(hyperedge)}`,
            `Overall Confidence: ${this._formatConfidence(strongestBelief.truth)} (f: ${strongestBelief.truth.frequency.toFixed(2)})\n`
        ];

        explanation.push(this._getSupportingEvidence(hyperedgeId));
        explanation.push(this._getConflictingEvidence(hyperedge, strongestBelief));
        explanation.push(this._getContradictionInfo(hyperedgeId));

        return explanation.filter(Boolean).join('\n');
    }

    _getSupportingEvidence(hyperedgeId) {
        const derivationPath = [];
        this._traceDerivation(hyperedgeId, derivationPath, 3, new Set());
        const supportingPremises = derivationPath.slice(0, -1);

        if (supportingPremises.length === 0) {
            return "Supporting Evidence: This appears to be a base assertion.";
        }

        const evidenceLines = supportingPremises.map(premise =>
            `  - Because of: ${this._formatHyperedge(premise)} (Confidence: ${this._formatConfidence(premise.truth)})`
        );
        return ["Supporting Evidence (from derivation):", ...evidenceLines].join('\n');
    }

    _getConflictingEvidence(hyperedge, strongestBelief) {
        const conflictingBeliefs = hyperedge.beliefs.filter(b => b.id !== strongestBelief.id);
        if (conflictingBeliefs.length === 0) return null;

        const evidenceLines = conflictingBeliefs.map(belief =>
            `  - An alternative belief exists with confidence ${this._formatConfidence(belief.truth)} (f: ${belief.truth.frequency.toFixed(2)})`
        );
        return ["\nConflicting Evidence (overridden or merged):", ...evidenceLines].join('\n');
    }

    _getContradictionInfo(hyperedgeId) {
        const contradiction = this.nar.contradictionManager.contradictions.get(hyperedgeId);
        if (contradiction && contradiction.resolved) {
            return `\nNote: This belief was part of a contradiction resolved via the '${contradiction.resolutionStrategy || 'merge'}' strategy.`;
        }
        return null;
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

        while (queue.length > 0) {
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
                    edges.push({from: premise.id, to: node.id, label: node.derivationRule});
                    queue.push(premise);
                });
            }
        }
        return {nodes, edges};
    }

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
                    premiseNodes.push(premisePath[0]);
                }
            }
        }

        path.unshift({
            id: hyperedge.id,
            type: hyperedge.type,
            args: hyperedge.args,
            truth: strongestBelief.truth,
            derivationRule,
            premises: premiseNodes
        });
    }

    _formatDetailedExplanation(hyperedgeId, path, options) {
        const {includeConfidence = true, maxAlternatives = 2} = options;
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        if (!hyperedge) return "Hyperedge not found";

        const conclusion = path[0];
        return [
            `CONCLUSION: ${this._formatHyperedge(conclusion)}`,
            includeConfidence ? `Confidence: ${this._formatConfidence(conclusion.truth)}\n` : null,
            "REASONING PATH:",
            this._formatExplanationTree(conclusion, 0),
            this._getAlternativePerspectives(hyperedge, hyperedgeId, maxAlternatives),
            this._getContradictionInfo(hyperedgeId),
            this._getTemporalContext()
        ].filter(Boolean).join('\n');
    }

    _getAlternativePerspectives(hyperedge, hyperedgeId, maxAlternatives) {
        if (hyperedge.beliefs.length <= 1) return null;

        const alternatives = hyperedge.beliefs
            .slice(1, maxAlternatives + 1)
            .map(belief => ({
                truth: belief.truth,
                path: this._findAlternativePath(hyperedgeId, belief)
            }));

        if (alternatives.length === 0) return null;

        const alternativeLines = alternatives.map((alt, i) => {
            const reasoning = (alt.path && alt.path.length > 0)
                ? `   Reasoning: ${alt.path.map(s => this._formatHyperedge(s)).join(' → ')}`
                : '';
            return `${i + 1}. A belief with confidence ${this._formatConfidence(alt.truth)} also exists.\n${reasoning}`;
        }).join('\n');

        return `\nALTERNATIVE PERSPECTIVES (${alternatives.length} of ${hyperedge.beliefs.length - 1} total):\n${alternativeLines}`;
    }

    _getTemporalContext() {
        const temporalContext = this.nar.temporalManager.getContext();
        if (temporalContext && temporalContext.currentPeriod) {
            return `\nTEMPORAL CONTEXT: The reasoning occurred during the ${temporalContext.currentPeriod} in the ${temporalContext.season}.`;
        }
        return null;
    }

    _findAlternativePath(hyperedgeId, belief) {
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

        const formattedStep = template
            .replace('{conclusion}', this._formatHyperedge(node))
            .replace('{premise1}', premise1)
            .replace('{premise2}', premise2);

        const childExplanations = (node.premises || [])
            .map(premiseNode => this._formatExplanationTree(premiseNode, level + 1))
            .join('');

        return `${indent}- ${formattedStep} (Confidence: ${this._formatConfidence(node.truth)})\n${childExplanations}`;
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

        const premiseStories = (conclusion.premises || []).map(p => this._formatTermForStory(p));
        const premiseText = premiseStories.length > 0
            ? `It's based on a few things I know. For instance, I know that ${premiseStories.join(' and that ')}. `
            : '';

        return `Let me tell you how I came to believe that ${this._formatTermForStory(conclusion)}. ${premiseText}From this, it is reasonable to conclude that ${this._formatTermForStory(conclusion)}.`;
    }

    _formatHyperedge(hyperedge) {
        if (!hyperedge) return "an unknown concept";
        const args = hyperedge.args ? hyperedge.args.join(', ') : '';
        return `${hyperedge.type}(${args})`;
    }

    _formatHyperedgeSimple(hyperedge) {
        if (!hyperedge) return "an unknown concept";
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
