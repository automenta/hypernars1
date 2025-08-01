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
        if (content.startsWith('(') && content.endsWith(')')) {
            let depth = 0;
            let isWrapper = true;
            for (let i = 0; i < content.length - 1; i++) {
                if (content[i] === '(') depth++;
                if (content[i] === ')') depth--;
                if (depth === 0) { isWrapper = false; break; }
            }
            if (isWrapper) return this._parseRecursive(content.slice(1, -1), truth, priority);
        }
        for (let p = 1; p <= 3; p++) {
            const ops = this.operators.filter(op => op.precedence === p);
            let depth = 0;
            for (let i = content.length - 1; i >= 0; i--) {
                if (content[i] === ')') depth++;
                if (content[i] === '(') depth--;
                if (depth === 0) {
                    for (const op of ops) {
                        if (content.substring(i - op.symbol.length + 1, i + 1) === op.symbol) {
                            const left = content.substring(0, i - op.symbol.length + 1);
                            const right = content.substring(i + 1);
                            return { type: op.type, args: [this._parseRecursive(left, truth, priority), this._parseRecursive(right, truth, priority)], truth, priority };
                        }
                    }
                }
            }
        }
        if (content.startsWith('$') || content.startsWith('?')) {
            return { type: 'Variable', args: [content], truth, priority };
        }
        // This is the base case for a simple term. It should not be a nested structure.
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
