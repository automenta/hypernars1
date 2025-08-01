import { ExpressionEvaluatorBase } from './ExpressionEvaluatorBase.js';
import { TruthValue } from '../support/TruthValue.js';
import { id } from '../support/utils.js';

/**
 * An advanced expression evaluator that merges the recursive parser from
 * `enhance.b.md` with the query/question handling from the original implementation.
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
        const { limit = 10, minExpectation = 0.0 } = options;
        const results = [];

        // Handle wildcard queries
        if (pattern.includes('*')) {
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
        } else {
            // Handle exact queries
            const parsed = this.parse(pattern.replace('?', ''));
            const hyperedgeId = this._getParsedStructureId(parsed);
            const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
            if (hyperedge) {
                results.push({ id: hyperedgeId, bindings: {}, expectation: hyperedge.getTruth().expectation(), hyperedge });
            }
        }

        return results.filter(r => r.expectation >= minExpectation).sort((a, b) => b.expectation - a.expectation);
    }

    parse(expression) {
        let truth = new TruthValue(1.0, 0.9);
        let priority = 1.0;
        let content = expression.trim();

        // Match various truth value formats: %f;c%, %f;c;p%, #priority#
        const truthMatch = content.match(/(?:%([\d.]+);([\d.]+)(?:;([\d.]+))?%|#([\d.]+)#)$/);
        if (truthMatch) {
            if (truthMatch[0].startsWith('%')) {
                truth = new TruthValue(
                    parseFloat(truthMatch[1]),
                    parseFloat(truthMatch[2]),
                );
                if (truthMatch[3]) {
                    priority = parseFloat(truthMatch[3]);
                }
            } else {
                priority = parseFloat(truthMatch[4]);
            }
            content = content.replace(truthMatch[0], '').trim();
        }

        // Strip outer angle brackets for parsing, e.g., <bird --> flyer>
        if (content.startsWith('<') && content.endsWith('>')) {
            content = content.slice(1, -1).trim();
        }

        return this._parseRecursive(content, truth, priority);
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
            return { type: 'Variable', args: [content], truth, priority };
        }

        // Default to a simple term
        return { type: 'Term', args: [content], truth, priority };
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
