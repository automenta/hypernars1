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
    // Handle truth value annotations with multiple formats
    let truth = TruthValue.certain();
    let priority = 1.0;
    let content = expression.trim();

    // Match various truth value formats: %f;c%, %f;c;p%, #priority#
    const truthMatch = content.match(/%([\d.]+);([\d.]+)(?:;([\d.]+))?%|#[\d.]+#/);
    if (truthMatch) {
      if (truthMatch[0].startsWith('%')) {
        truth = new TruthValue(
          parseFloat(truthMatch[1]),
          parseFloat(truthMatch[2]),
          truthMatch[3] ? parseFloat(truthMatch[3]) : 1.0
        );
      } else {
        priority = parseFloat(truthMatch[0].slice(1, -1));
      }
      content = content.replace(truthMatch[0], '').trim();
    }

    // Handle negation properly
    if (content.startsWith('!')) {
      return {
        type: 'Negation',
        args: [this._parseNALExpression(content.substring(1))],
        truth,
        priority
      };
    }

    // Handle complex nested expressions with proper precedence
    const operators = [
      { symbol: '==>', precedence: 1, type: 'Implication' },
      { symbol: '<=>', precedence: 1, type: 'Equivalence' },
      { symbol: '&&', precedence: 2, type: 'Conjunction' },
      { symbol: '||', precedence: 2, type: 'Disjunction' },
      { symbol: '-->', precedence: 3, type: 'Inheritance' },
      { symbol: '<->', precedence: 3, type: 'Similarity' }
    ];

    // Find operator with lowest precedence (highest number) for recursive parsing
    let bestOp = null;
    let depth = 0;
    let inQuotes = false;

    for (let i = 0; i < content.length; i++) {
      if (content[i] === '(' || content[i] === '[' || content[i] === '{') depth++;
      else if (content[i] === ')' || content[i] === ']' || content[i] === '}') depth--;
      else if (content[i] === '"' || content[i] === "'") inQuotes = !inQuotes;

      if (depth === 0 && !inQuotes) {
        for (const op of operators) {
          if (i > 0 && i + op.symbol.length <= content.length - 1 &&
              content.substring(i, i + op.symbol.length) === op.symbol) {
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
      return {
        type: bestOp.type,
        args: [
          this._parseNALExpression(left),
          this._parseNALExpression(right)
        ],
        truth,
        priority
      };
    }

    // Handle product terms with proper argument extraction
    if (content.startsWith('(') && content.includes('*') && content.endsWith(')')) {
      const terms = content.slice(1, -1)
        .split('*')
        .map(t => t.trim())
        .filter(t => t);
      return { type: 'Product', args: terms, truth, priority };
    }

    // Handle image terms with position specification
    const imageMatch = content.match(/\((\/|\*)\s*,\s*([^,]+)\s*,\s*([^)]+)\)/);
    if (imageMatch) {
      const isExtensional = imageMatch[1] === '/';
      return {
        type: isExtensional ? 'ImageExt' : 'ImageInt',
        args: [
          imageMatch[2],
          imageMatch[3],
          isExtensional ? '1' : '1' // Default position
        ],
        truth,
        priority
      };
    }

    // Handle variables and simple terms
    if (content.startsWith('$') || content.startsWith('?')) {
      return { type: 'Variable', args: [content], truth, priority };
    }

    // Default to Term
    return { type: 'Term', args: [content], truth, priority };
  }
}
