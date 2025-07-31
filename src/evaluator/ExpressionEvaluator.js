import { TruthValue } from '../support/TruthValue.js';
import { Budget } from '../support/Budget.js';

export class ExpressionEvaluator {
  constructor(nar) {
    this.nar = nar;
  }

  parseAndAdd(nalStatement, options = {}) {
    const parsed = this._parseNALExpression(nalStatement);
    if (parsed) {
        return this.nar.addHyperedge(parsed.type, parsed.args, {
            truth: parsed.truth,
            budget: options.budget || Budget.full().scale(parsed.priority || 1.0)
        });
    }
    return null;
  }

  parseQuestion(question, options = {}) {
    const questionId = this.nar.generateQuestionId(question);
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            this.nar.questionPromises.delete(questionId);
            reject(new Error(`Question timed out after ${this.nar.config.questionTimeout}ms: ${question}`));
        }, this.nar.config.questionTimeout);

        this.nar.questionPromises.set(questionId, { resolve, reject, timer, options });
        this._processQuestion(question, questionId);
    });
  }

  _processQuestion(question, questionId) {
      // This method remains largely the same, but would benefit from the improved parser
      // For now, we'll keep the existing logic which is simple but functional.
      const { type, args } = this.parseQuestionPattern(question);
      this.nar.derive(type, ...args);
  }

  parseQuestionPattern(question) {
    const trimmed = question.trim().replace(/\?$/, '');
    const parsed = this._parseNALExpression(trimmed);
    return { type: parsed.type, args: parsed.args };
  }

  evaluate(expression, context = {}) {
    const termId = `Term(${expression.replace('?', '')})`;
    const term = this.nar.hypergraph.get(termId);
    return term && term.getTruth().expectation() > 0.5;
  }

  query(pattern, options = { limit: 10 }) {
    // Placeholder implementation
    const results = [];
    for (const [id, hyperedge] of this.nar.hypergraph.entries()) {
        if (id.startsWith(pattern.replace('*', ''))) {
            results.push({
                ...hyperedge,
                truth: hyperedge.getTruth()
            });
        }
        if (results.length >= options.limit) {
            break;
        }
    }
    return results;
  }

  _parseNALExpression(expression) {
    let truth = TruthValue.certain();
    let priority = 1.0;
    let content = expression.trim();

    const truthMatch = content.match(/%([\d.]+);([\d.]+)%/);
    if (truthMatch) {
        truth = new TruthValue(parseFloat(truthMatch[1]), parseFloat(truthMatch[2]));
        content = content.replace(truthMatch[0], '').trim();
    }

    if (content.startsWith('<') && content.endsWith('>.')) {
        content = content.slice(1, -2);
    } else if (content.startsWith('<') && content.endsWith('>')) {
        content = content.slice(1, -1);
    }


    const operators = [
        { symbol: '<=>', type: 'Equivalence', precedence: 4 },
        { symbol: '==>', type: 'Implication', precedence: 3 },
        { symbol: '<->', type: 'Similarity', precedence: 2 },
        { symbol: '-->', type: 'Inheritance', precedence: 1 }
    ];

    for (const op of operators) {
        const index = content.indexOf(op.symbol);
        if (index !== -1) {
            const left = content.substring(0, index).trim();
            const right = content.substring(index + op.symbol.length).trim();
            return {
                type: op.type,
                args: [left, right],
                truth,
                priority
            };
        }
    }

    if (content.startsWith('(') && content.includes('*') && content.endsWith(')')) {
        const terms = content.slice(1, -1).split('*').map(t => t.trim()).filter(t => t);
        return { type: 'Product', args: terms, truth, priority };
    }

    return { type: 'Term', args: [content], truth, priority };
  }
}
