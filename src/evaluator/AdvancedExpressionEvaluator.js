import { ExpressionEvaluatorBase } from './ExpressionEvaluatorBase.js';
import { TruthValue } from '../support/TruthValue.js';
import { Budget } from '../support/Budget.js';
import { id } from '../support/utils.js';

/**
 * An advanced expression evaluator that merges the recursive parser from
 * `enhance.b.md` with the query/question handling from the original implementation.
 */
export class AdvancedExpressionEvaluator extends ExpressionEvaluatorBase {
    constructor(nar) {
        super(nar);
        this.operators = [
            { symbol: '==>', precedence: 1, type: 'Implication' },
            { symbol: '<=>', precedence: 1, type: 'Equivalence' },
            { symbol: '&&', precedence: 2, type: 'Conjunction' },
            { symbol: '||', precedence: 2, type: 'Disjunction' },
            { symbol: '-->', precedence: 3, type: 'Inheritance' },
            { symbol: '<->', precedence: 3, type: 'Similarity' }
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
        const questionId = id('Question', [question]);
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.nar.state.questionPromises.delete(questionId);
                reject(new Error(`Question timed out: ${question}`));
            }, this.nar.config.questionTimeout || 5000);

            this.nar.state.questionPromises.set(questionId, { resolve, reject, timer, options });

            const parsed = this.parse(question.replace('?', ''));
            if (!parsed || !parsed.type || !parsed.args) return;

            const task = { type: 'question', hyperedgeType: parsed.type, args: parsed.args };
            const budget = this.nar.memoryManager.dynamicBudgetAllocation(task, { importance: 1.0, urgency: 1.0 });
            const hyperedgeId = this._getParsedStructureId(parsed);
            if(hyperedgeId) {
                this.nar.propagation.propagate(hyperedgeId, 1.0, budget, 0, 0, []);
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

        const truthMatch = content.match(/%([\d.]+);([\d.]+)%$/);
        if (truthMatch) {
            truth = new TruthValue(parseFloat(truthMatch[1]), parseFloat(truthMatch[2]));
            content = content.replace(truthMatch[0], '').trim();
        }

        return this._parseRecursive(content, truth, priority);
    }

    _parseRecursive(content, truth, priority) {
        content = content.trim();

        if (content.startsWith('¬')) {
            const negatedContent = content.substring(1).trim();
            const parsed = this._parseRecursive(negatedContent, truth, priority);
            if (parsed) {
                parsed.truth = parsed.truth.negate();
            }
            return parsed;
        }

        // Strip outer brackets first. This is a simplification that ignores precedence
        // but is more robust for the common cases.
        if (content.startsWith('<') && content.endsWith('>')) {
            content = content.slice(1, -1).trim();
        } else if (content.startsWith('(') && content.endsWith(')')) {
            content = content.slice(1, -1).trim();
        }

        // Find the first operator from left to right.
        // This is a simplification and does not handle precedence correctly for complex cases.
        for (const op of this.operators) {
            const index = content.indexOf(op.symbol);
            if (index !== -1) {
                const left = content.substring(0, index);
                const right = content.substring(index + op.symbol.length);
                return {
                    type: op.type,
                    args: [this._parseRecursive(left, truth, priority), this._parseRecursive(right, truth, priority)],
                    truth,
                    priority
                };
            }
        }

        // Base case: no operators found.
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
