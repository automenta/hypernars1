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
            // Handle simple wildcard queries with the old logic for now.
            if (pattern.includes('*') && !pattern.includes('<')) {
                 results = this._wildcardQuery(pattern, options);
            } else {
                results = this.queryWithBinding(pattern, options);
            }

            // Sort and limit results
            this._sortQueryResults(results, sortBy);
            return results.slice(0, limit);
        } catch (e) {
            this.nar.emit('log', { message: `Query execution failed: ${e.message}`, level: 'error', error: e });
            return [];
        } finally {
            const duration = Date.now() - startTime;
            // Optionally record query performance
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

    /**
     * Enhanced query processing with variable binding and constraint satisfaction,
     * based on the `enhance.b.md` and `enhance.d.md` proposals.
     * @param {string} pattern - The query pattern, e.g., '<$x --> bird>'.
     * @param {object} options - Query options like { limit, minExpectation }.
     * @returns {Array} A list of matching results with bindings.
     */
    queryWithBinding(pattern, options = {}) {
        const { minExpectation = 0.5 } = options;
        const results = [];
        const parsedPattern = this.parse(pattern);

        // Find all hyperedges that could potentially match the pattern's top-level type.
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

        // Type mismatch
        if (patternNode.type !== hyperedgeNode.type) {
            return false;
        }

        // Argument count mismatch
        if (patternNode.args.length !== hyperedgeNode.args.length) {
            return false;
        }

        // Recursively match arguments
        for (let i = 0; i < patternNode.args.length; i++) {
            const patternArg = patternNode.args[i];
            const hyperedgeArgId = hyperedgeNode.args[i]; // This is an ID string

            if (typeof patternArg === 'object' && patternArg.type === 'Variable') {
                const varName = patternArg.args[0];
                if (bindings.has(varName)) {
                    // If variable is already bound, it must match the current value (which is an ID)
                    if (bindings.get(varName) !== hyperedgeArgId) {
                        return false;
                    }
                } else {
                    // New binding: bind the variable name to the hyperedge argument ID
                    bindings.set(varName, hyperedgeArgId);
                }
            } else if (typeof patternArg === 'object' && patternArg.type === 'Term') {
                if (patternArg.args[0] !== hyperedgeArgId) {
                    return false;
                }
            } else if (typeof patternArg === 'object' && patternArg.type) {
                // Nested structure: patternArg is a parsed object, hyperedgeArgId is the ID of the nested hyperedge
                const nestedHyperedge = this.nar.state.hypergraph.get(hyperedgeArgId);
                if (!nestedHyperedge || !this._matchRecursive(patternArg, nestedHyperedge, bindings)) {
                    return false;
                }
            } else {
                // Simple term match: patternArg is a string, hyperedgeArgId is a string
                if (patternArg !== hyperedgeArgId) {
                    return false;
                }
            }
        }

        // If all arguments matched, the pattern matches
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

        // Match truth value and priority, which can be at the end
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

            if (truthMatch[3]) priority = parseFloat(truthMatch[3]); // Priority from truth value
            if (truthMatch[4]) priority = parseFloat(truthMatch[4]); // Priority from hash syntax

            content = content.substring(0, truthMatch.index).trim();
        }

        // Handle sentence punctuation (e.g., belief assertions ending in '.')
        if (content.endsWith('.')) {
            content = content.slice(0, -1).trim();
        }

        // Handle statements enclosed in <...>
        if (content.startsWith('<') && content.endsWith('>')) {
            content = content.slice(1, -1).trim();
        }

        try {
            return this._parseRecursive(content, truth, priority);
        } catch (e) {
            if (e instanceof NALParserError) {
                throw e; // Re-throw our custom errors
            }
            // Wrap other errors for consistency
            throw new NALParserError(`Failed to parse expression: ${e.message}`, { content });
        }
    }

    _parseRecursive(content, truth, priority) {
        content = content.trim();

        if (content.startsWith('!')) {
            const negatedContent = content.substring(1).trim();
            return {
                type: 'Negation',
                args: [this._parseRecursive(negatedContent, truth, priority)],
                truth,
                priority
            };
        }

        // Check for balanced parentheses
        let balance = 0;
        for (const char of content) {
            if (char === '(') balance++;
            else if (char === ')') balance--;
        }
        if (balance !== 0) {
            throw new Error(`Mismatched parentheses in expression: ${content}`);
        }

        // Handle parenthesis stripping
        if (content.startsWith('(') && content.endsWith(')')) {
            let balance = 0;
            let isPaired = true;
            for (let i = 0; i < content.length; i++) {
                if (content[i] === '(') balance++;
                else if (content[i] === ')') balance--;
                if (balance === 0 && i < content.length - 1) {
                    isPaired = false;
                    break;
                }
            }
            if (isPaired) {
                content = content.slice(1, -1).trim();
            }
        }

        let bestOp = null;
        let depth = 0;
        let inQuotes = false;

        for (let i = 0; i < content.length; i++) {
            if (content[i] === '(') depth++;
            else if (content[i] === ')') depth--;
            else if (content[i] === '"' || content[i] === "'") inQuotes = !inQuotes;

            if (depth === 0 && !inQuotes) {
                for (const op of this.operators) {
                    if (content.substring(i, i + op.symbol.length) === op.symbol) {
                        if (!bestOp || op.precedence >= bestOp.precedence) {
                            bestOp = { ...op, position: i };
                        }
                    }
                }
            }
        }

        if (bestOp) {
            const left = content.substring(0, bestOp.position).trim();
            const right = content.substring(bestOp.position + bestOp.symbol.length).trim();
            return {
                type: bestOp.type,
                args: [
                    this._parseRecursive(left, truth, priority),
                    this._parseRecursive(right, truth, priority)
                ],
                truth,
                priority
            };
        }

        return this._parseTerm(content, truth, priority);
    }

    _parseTerm(content, truth, priority) {
        // Handle product terms: (*, a, b, c)
        if (content.startsWith('(*') && content.endsWith(')')) {
            const terms = content.slice(2, -1).split(',').map(t => t.trim()).filter(t => t);
            return { type: 'Product', args: terms, truth, priority };
        }

        // Handle image terms: (/, a, b) or (*, a, b, c)
        const imageMatch = content.match(/^\((\/|\*)\s*,\s*([^,]+)\s*,\s*([^)]+)\)/);
        if (imageMatch) {
            const isExtensional = imageMatch[1] === '/';
            return {
                type: isExtensional ? 'ImageExt' : 'ImageInt',
                args: [imageMatch[2].trim(), imageMatch[3].trim()],
                truth,
                priority
            };
        }

        if (content.startsWith('$') || content.startsWith('?')) {
            const match = content.match(/^([$?]\w+)(?:\{(.*)\})?$/);
            if (match) {
                const [, varName, constraintsStr] = match;
                const constraints = constraintsStr ? this._parseConstraints(constraintsStr) : {};
                return { type: 'Variable', args: [varName], constraints, truth, priority };
            }
            // Fallback for simple variables without constraints
            return { type: 'Variable', args: [content], constraints: {}, truth, priority };
        }

        // Default to a simple term
        return { type: 'Term', args: [content], truth, priority };
    }

    _parseConstraints(constraintsStr) {
        const constraints = {};
        const constraintPairs = constraintsStr.split(',');
        for (const pair of constraintPairs) {
            const parts = pair.split('=');
            if (parts.length === 2) {
                const key = parts[0].trim();
                const value = parts[1].trim();
                // A more advanced implementation would parse the value type (number, bool, etc.)
                constraints[key] = value;
            }
        }
        return constraints;
    }

    _addParsedStructure(parsed, options) {
        if (!parsed || !parsed.args) return null; // Guard against invalid parsed objects

        const argIds = parsed.args.map(arg => {
            // If the argument is a complex nested structure, recurse.
            // Otherwise, it's a simple term/variable string.
            if (typeof arg === 'object' && arg !== null && arg.type) {
                return this._addParsedStructure(arg, options);
            }
            return arg; // It's a string, return as is
        });

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
