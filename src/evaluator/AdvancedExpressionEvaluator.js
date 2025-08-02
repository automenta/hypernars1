import { ExpressionEvaluatorBase } from './ExpressionEvaluatorBase.js';
import { TruthValue } from '../support/TruthValue.js';
import { id } from '../support/utils.js';

// Custom error classes for precise error handling, as per `enhance.c.md`
class NALParserError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = 'NALParserError';
        this.details = details;
    }
}

/**
 * An advanced expression evaluator that merges the recursive parser from
 * `enhance.b.md` with the query/question handling from the original implementation,
 * and adds robust error handling from `enhance.c.md`.
 */
export class AdvancedExpressionEvaluator extends ExpressionEvaluatorBase {
    constructor(nar) {
        super(nar);
        // This operator list is now used inside the new parser logic
        this.operators = [
            { symbol: '==>', precedence: 4, type: 'Implication' },
            { symbol: '<=>', precedence: 4, type: 'Equivalence' },
            { symbol: '-->', precedence: 3, type: 'Inheritance' },
            { symbol: '&&', precedence: 2, type: 'Conjunction' },
            { symbol: '||', precedence: 2, type: 'Disjunction' },
            { symbol: '<->', precedence: 1, type: 'Similarity' }
        ];
    }

    parseAndAdd(expression, options = {}) {
        const parsed = this.parse(expression);
        if (parsed) {
            return this._addParsedStructure(parsed, options);
        }
        return null;
    }

    parseQuestion(question, options = {}) {
        const cleanQuestion = question.endsWith('?') ? question.slice(0, -1) : question;
        const questionId = id('Question', [cleanQuestion]);

        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.nar.state.questionPromises.delete(questionId);
                reject(new Error(`Question timed out: ${cleanQuestion}`));
            }, this.nar.config.questionTimeout || 5000);

            this.nar.state.questionPromises.set(questionId, { resolve, reject, timer, options });

            const parsed = this.parse(cleanQuestion);
            if (!parsed || !parsed.type || !parsed.args) return;

            const task = { type: 'question', hyperedgeType: parsed.type, args: parsed.args };
            const budget = this.nar.memoryManager.allocateResources(task, { importance: 1.0, urgency: 1.0 });
            const hyperedgeId = this._getParsedStructureId(parsed);
            if (hyperedgeId) {
                this.nar.propagation.propagate({
                    target: hyperedgeId,
                    activation: 1.0,
                    budget: budget,
                    pathHash: 0,
                    pathLength: 0,
                    derivationPath: []
                });
            }
        });
    }

    query(pattern, options = {}) {
        const { limit = 10, minExpectation = 0.5, sortBy = 'expectation' } = options;
        const startTime = Date.now();

        try {
            let results;
            if (!pattern.match(/[<*?&|]/)) {
                const hyperedge = this.nar.state.hypergraph.get(pattern);
                if (hyperedge && hyperedge.getTruth().expectation() >= minExpectation) {
                    return [{
                        id: pattern,
                        bindings: {},
                        expectation: hyperedge.getTruth().expectation(),
                        hyperedge
                    }];
                }
                return [];
            }

            if (pattern.includes('*') && !pattern.includes('<')) {
                 results = this._wildcardQuery(pattern, options);
            } else {
                results = this.queryWithBinding(pattern, options);
            }

            this._sortQueryResults(results, sortBy);
            return results.slice(0, limit);
        } catch (e) {
            this.nar.emit('log', { message: `Query execution failed: ${e.message}`, level: 'error', error: e });
            return [];
        } finally {
            const duration = Date.now() - startTime;
        }
    }

    _wildcardQuery(pattern, options) {
        const { limit = 10, minExpectation = 0.0 } = options;
        const results = [];
        const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\(/g, '\\(').replace(/\)/g, '\\)'));
        for (const [id, hyperedge] of this.nar.state.hypergraph.entries()) {
            if (regex.test(id)) {
                results.push({
                    id,
                    bindings: {},
                    expectation: hyperedge.getTruth().expectation(),
                    hyperedge,
                });
            }
            if (results.length >= limit) break;
        }
        return results.filter(r => r.expectation >= minExpectation);
    }

    queryWithBinding(pattern, options = {}) {
        const { minExpectation = 0.5 } = options;
        const results = [];
        const parsedPattern = this.parse(pattern);

        const candidateEdges = this.nar.state.index.byType.get(parsedPattern.type) || new Set();

        for (const edgeId of candidateEdges) {
            const hyperedge = this.nar.state.hypergraph.get(edgeId);
            if (!hyperedge) continue;

            const bindings = new Map();
            if (this._matchRecursive(parsedPattern, hyperedge, bindings)) {
                const expectation = hyperedge.getTruth().expectation();
                if (expectation >= minExpectation) {
                    results.push({
                        id: edgeId,
                        bindings: Object.fromEntries(bindings),
                        expectation,
                        hyperedge
                    });
                }
            }
        }

        return results;
    }

    _matchRecursive(patternNode, hyperedgeNode, bindings) {
        if (!patternNode || !hyperedgeNode) return false;
        if (patternNode.type !== hyperedgeNode.type) return false;
        if (patternNode.args.length !== hyperedgeNode.args.length) return false;

        for (let i = 0; i < patternNode.args.length; i++) {
            const patternArg = patternNode.args[i];
            const hyperedgeArgId = hyperedgeNode.args[i];

            if (typeof patternArg === 'object' && patternArg.type === 'Variable') {
                const varName = patternArg.args[0];
                if (bindings.has(varName)) {
                    if (bindings.get(varName) !== hyperedgeArgId) return false;
                } else {
                    if (this._satisfiesConstraints(hyperedgeArgId, patternArg.constraints)) {
                        bindings.set(varName, hyperedgeArgId);
                    } else {
                        return false; // Constraint check failed
                    }
                }
            } else if (typeof patternArg === 'object' && patternArg.type === 'Term') {
                const expectedId = id(patternArg.type, patternArg.args);
                if (expectedId !== hyperedgeArgId && patternArg.args[0] !== hyperedgeArgId) {
                    return false;
                }
            } else if (typeof patternArg === 'object' && patternArg.type) {
                const nestedHyperedge = this.nar.state.hypergraph.get(hyperedgeArgId);
                if (!nestedHyperedge || !this._matchRecursive(patternArg, nestedHyperedge, bindings)) {
                    return false;
                }
            } else {
                if (patternArg !== hyperedgeArgId) return false;
            }
        }
        return true;
    }

    _satisfiesConstraints(hyperedgeId, constraints) {
        if (!constraints || Object.keys(constraints).length === 0) {
            return true;
        }

        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        if (!hyperedge) {
            // If the constraint is about the term not existing, this might be valid
            if (constraints.exists === 'false') return true;
            return false;
        }

        for (const [key, value] of Object.entries(constraints)) {
            switch (key) {
                case 'type':
                    if (hyperedge.type !== value) return false;
                    break;
                case 'minExpectation':
                    if (hyperedge.getTruth().expectation() < parseFloat(value)) return false;
                    break;
                case 'maxExpectation':
                    if (hyperedge.getTruth().expectation() > parseFloat(value)) return false;
                    break;
                case 'isA':
                    const instanceOfId = id('Inheritance', [hyperedgeId, value]);
                    if (!this.nar.state.hypergraph.has(instanceOfId)) return false;
                    break;
                // Add more constraint checks here as needed
            }
        }

        return true;
    }

    _sortQueryResults(results, sortBy) {
        switch (sortBy) {
            case 'expectation':
                results.sort((a, b) => b.expectation - a.expectation);
                break;
            case 'activation':
                results.sort((a, b) =>
                    (this.nar.state.activations.get(b.id) || 0) - (this.nar.state.activations.get(a.id) || 0)
                );
                break;
            case 'recent':
                results.sort((a, b) => {
                    const aTime = this.nar.state.hypergraph.get(a.id)?.beliefs[0]?.timestamp || 0;
                    const bTime = this.nar.state.hypergraph.get(b.id)?.beliefs[0]?.timestamp || 0;
                    return bTime - aTime;
                });
                break;
            default:
                results.sort((a, b) => b.expectation - a.expectation);
        }
    }

    parse(expression) {
        if (typeof expression !== 'string' || !expression.trim()) {
            throw new NALParserError('Input must be a non-empty string.', { expression });
        }

        let truth = new TruthValue(1.0, 0.9);
        let priority = 1.0;
        let content = expression.trim();

        const truthMatch = content.match(/(?:%([\d.]+);([\d.]+)(?:;([\d.]+))?%|#([\d.]+)#)\s*$/);
        if (truthMatch) {
            const freqStr = truthMatch[1];
            const confStr = truthMatch[2];
            if (freqStr !== undefined && confStr !== undefined) {
                const frequency = parseFloat(freqStr);
                const confidence = parseFloat(confStr);
                if (isNaN(frequency) || frequency < 0 || frequency > 1) {
                    throw new NALParserError('Invalid truth frequency value.', { value: freqStr });
                }
                if (isNaN(confidence) || confidence < 0 || confidence > 1) {
                    throw new NALParserError('Invalid truth confidence value.', { value: confStr });
                }
                truth = new TruthValue(frequency, confidence);
            }

            if (truthMatch[3]) priority = parseFloat(truthMatch[3]);
            if (truthMatch[4]) priority = parseFloat(truthMatch[4]);

            content = content.substring(0, truthMatch.index).trim();
        }

        if (content.endsWith('.')) {
            content = content.slice(0, -1).trim();
        }

        if (content.startsWith('<') && content.endsWith('>')) {
            content = content.slice(1, -1).trim();
        }

        try {
            const parsed = this._parseNALExpression(content);
            parsed.truth = truth;
            parsed.priority = priority;
            return parsed;
        } catch (e) {
            if (e instanceof NALParserError) {
                throw e;
            }
            throw new NALParserError(`Failed to parse expression: ${e.message}`, { content });
        }
    }

    _parseNALExpression(content) {
        content = content.trim();

        // 1. Handle Negation
        if (content.startsWith('!')) {
            return { type: 'Negation', args: [this._parseNALExpression(content.substring(1))] };
        }

        // 2. Handle Parentheses
        let isPaired = false;
        if (content.startsWith('(') && content.endsWith(')')) {
            let balance = 0;
            isPaired = true;
            for (let i = 0; i < content.length; i++) {
                if (content[i] === '(') balance++;
                else if (content[i] === ')') balance--;
                if (balance === 0 && i < content.length - 1) {
                    isPaired = false;
                    break;
                }
            }
        }
        if (isPaired) {
            content = content.slice(1, -1).trim();
        }

        // 3. Handle Operators (Implication, Conjunction, etc.)
        let bestOp = null;
        let depth = 0;
        let inQuotes = false;
        for (let i = content.length - 1; i >= 0; i--) {
            const char = content[i];
            if (char === ')' || char === ']' || char === '}') depth++;
            else if (char === '(' || char === '[' || char === '{') depth--;
            else if (char === '"' || char === "'") inQuotes = !inQuotes;

            if (depth === 0 && !inQuotes) {
                for (const op of this.operators) {
                    if (content.substring(i, i + op.symbol.length) === op.symbol) {
                        if (!bestOp || op.precedence > bestOp.precedence) {
                            bestOp = { ...op, position: i };
                        }
                    }
                }
            }
        }

        if (bestOp) {
            const left = content.substring(0, bestOp.position).trim();
            const right = content.substring(bestOp.position + bestOp.symbol.length).trim();
            return { type: bestOp.type, args: [this._parseNALExpression(left), this._parseNALExpression(right)] };
        }

        // 4. Handle specific term structures (Product, Image)
        const productMatch = content.match(/^\(\*\s*,\s*(.+)\)$/);
        if (productMatch) {
            const terms = productMatch[1].split(/\s*,\s*/).map(t => t.trim()).filter(Boolean);
            return { type: 'Product', args: terms };
        }

        const imageMatch = content.match(/^\((\/|\*)\s*,\s*(.+)\)$/);
        if (imageMatch) {
            const type = imageMatch[1] === '/' ? 'ImageExt' : 'ImageInt';
            const terms = imageMatch[2].split(/\s*,\s*/).map(t => t.trim()).filter(Boolean);
            return { type, args: terms };
        }

        // 5. Handle Variables
        if (content.startsWith('$') || content.startsWith('?')) {
            const constraintMatch = content.match(/^(\$[\w?]+)({(.*)})$/);
            if (constraintMatch) {
                const varName = constraintMatch[1];
                const constraints = this._parseConstraints(constraintMatch[3]);
                return { type: 'Variable', args: [varName], constraints };
            }
            return { type: 'Variable', args: [content] };
        }

        // 6. Default to simple Term
        return { type: 'Term', args: [content] };
    }

    _parseConstraints(constraintStr) {
        const constraints = {};
        if (!constraintStr) return constraints;
        const parts = constraintStr.split(',');
        parts.forEach(part => {
            const [key, value] = part.split('=').map(s => s.trim());
            if (key && value) {
                constraints[key] = value;
            }
        });
        return constraints;
    }

    _addParsedStructure(parsed, options) {
        if (!parsed || !parsed.args) return null;

        const argIds = parsed.args.map(arg => {
            if (typeof arg === 'object' && arg !== null && arg.type) {
                // For nested structures, we just need to ensure they exist.
                const argId = this._getParsedStructureId(arg); // Just get the ID
                if (!this.nar.state.hypergraph.has(argId)) {
                    // Add it with default options only if it's new.
                    this._addParsedStructure(arg, {});
                }
                return argId;
            }
            return arg; // It's a simple string term
        });

        // The top-level statement gets the specific truth/budget from the parsed expression.
        const finalOptions = { ...options, truth: parsed.truth, priority: parsed.priority };
        return this.nar.api.addHyperedge(parsed.type, argIds, finalOptions);
    }

    _getParsedStructureId(parsed) {
        if (!parsed || !parsed.args) return null; // Guard against invalid parsed objects

        const argIds = parsed.args.map(arg => {
            if (typeof arg === 'object' && arg !== null && arg.type) {
                return this._getParsedStructureId(arg);
            }
            return arg; // It's a string
        });
        return id(parsed.type, argIds);
    }
}
