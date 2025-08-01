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

  query(pattern, options = {}) {
    const results = [];
    const { limit = 10, minExpectation = 0.5 } = options;

    // Parse pattern to identify variables and constraints
    const parsedPattern = this._parseQueryPattern(pattern);
    const variables = new Set();
    const constraints = [];

    // Extract variables and constraints
    const extractInfo = (node) => {
      if (node.type === 'Variable') {
        variables.add(node.args[0]);
      } else if (node.type === 'Constraint') {
        constraints.push(node);
      } else if (node.args && Array.isArray(node.args)) {
        node.args.forEach(arg => extractInfo(arg));
      }
    };

    extractInfo(parsedPattern);

    // Generate all possible bindings
    const generateBindings = (node, bindings = {}) => {
      if (node.type === 'Variable') {
        const varName = node.args[0];
        if (bindings[varName]) return [bindings];

        // Get possible values for this variable from the hypergraph
        const possibleValues = this._getPossibleValues(varName, node.constraints);
        return possibleValues.map(value => ({
          ...bindings,
          [varName]: value
        }));
      }

      if (!node.args || !Array.isArray(node.args)) return [bindings];

      let allBindings = [bindings];
      for (const arg of node.args) {
        const newBindings = [];
        for (const b of allBindings) {
          const argBindings = generateBindings(arg, b);
          newBindings.push(...argBindings);
        }
        allBindings = newBindings;
      }
      return allBindings;
    };

    // Apply constraints to filter results
    const satisfiesConstraints = (bindings) => {
      return constraints.every(constraint => {
        const leftVal = this._evaluateConstraint(constraint.args[0], bindings);
        const rightVal = this._evaluateConstraint(constraint.args[1], bindings);
        return this._checkConstraint(constraint.operator, leftVal, rightVal);
      });
    };

    const allBindings = generateBindings(parsedPattern);
    const validBindings = allBindings.filter(satisfiesConstraints);

    // Convert to result format
    for (const bindings of validBindings.slice(0, limit)) {
      const result = {
        bindings,
        expectation: this._calculateBindingExpectation(bindings, parsedPattern)
      };

      if (result.expectation >= minExpectation) {
        results.push(result);
      }
    }

    return results.sort((a, b) => b.expectation - a.expectation);
  }

  _parseQueryPattern(pattern) {
    // This should use the main parser but handle query-specific syntax
    // For now, we'll just use the main parser.
    return this._parseNALExpression(pattern.replace('?', ''));
  }

  _getPossibleValues(variableName, constraints) {
    // In a real implementation, this would be a sophisticated search.
    // For now, return a few matching concepts from the hypergraph as placeholders.
    const values = new Set();
    this.nar.state.hypergraph.forEach((hyperedge, id) => {
      if (hyperedge.type === 'Term') {
        values.add(id);
      }
      hyperedge.args.forEach(arg => {
          if (typeof arg === 'string' && !arg.startsWith('$')) {
              values.add(`Term(${arg})`);
          }
      });
    });
    return Array.from(values).slice(0, 20); // Limit for performance
  }

  _calculateBindingExpectation(bindings, parsedPattern) {
    // Create a concrete NAL statement from the pattern and bindings
    let statement = JSON.stringify(parsedPattern);
    for (const [variable, value] of Object.entries(bindings)) {
        // This is a simplified substitution. A real one would be more careful.
        statement = statement.replace(new RegExp(JSON.stringify(variable), 'g'), JSON.stringify(value.replace(/Term\((.*)\)/, '$1')));
    }

    try {
        const parsedStatement = JSON.parse(statement);
        const hyperedgeId = this.nar.api.id(parsedStatement.type, parsedStatement.args);
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        return hyperedge ? hyperedge.getTruth().expectation() : 0.0;
    } catch (e) {
        return 0.0;
    }
  }

  _evaluateConstraint(arg, bindings) {
      // Placeholder
      return bindings[arg] || arg;
  }

  _checkConstraint(operator, left, right) {
      // Placeholder
      return true;
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
