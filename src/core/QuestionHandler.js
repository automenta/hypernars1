import { id } from '../support/utils.js';

export class QuestionHandler {
  constructor(nar) {
    this.nar = nar;
  }

  ask(question, options = {}) {
    const questionId = this.generateQuestionId(question);
    const { timeout = this.nar.config.questionTimeout } = options;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.nar.state.questionPromises.delete(questionId);
        this.nar.learningEngine.recordExperience(
            { derivationPath: ['timeout'], target: questionId },
            { success: false }
        );
        reject(new Error(`Question timed out after ${timeout}ms: ${question}`));
      }, timeout);

      this.nar.state.questionPromises.set(questionId, { resolve, reject, timer, options, answered: false });
      this._processQuestion(question, questionId);
    });
  }

  generateQuestionId(question) {
    return `Question(${question})|${Date.now()}`;
  }

  _processQuestion(question, questionId) {
    try {
      const { type, args, options } = this.nar.expressionEvaluator.parse(question.replace('?', ''));

      if (type === 'Inheritance') {
        const subjectArg = args[0];
        const predicateArg = args[1];

        // Safely get the string representation of the arguments
        const subject = (subjectArg && subjectArg.args) ? subjectArg.args[0] : subjectArg;
        const predicate = (predicateArg && predicateArg.args) ? predicateArg.args[0] : predicateArg;

        if (typeof subject === 'string' && subject.startsWith('$')) {
          this.nar.state.index.byArg.get(predicate)?.forEach(hyperedgeId => {
            const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
            if (hyperedge?.type === 'Inheritance' && hyperedge.args[1] === predicate) {
              this._answerQuestion(questionId, {
                type: 'Inheritance',
                args: [hyperedge.args[0], predicate],
                truth: hyperedge.getTruth()
              });
            }
          });
        }
        else if (typeof predicate === 'string' && predicate.startsWith('$')) {
          this.nar.state.index.byArg.get(subject)?.forEach(hyperedgeId => {
            const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
            if (hyperedge?.type === 'Inheritance' && hyperedge.args[0] === subject) {
              this._answerQuestion(questionId, {
                type: 'Inheritance',
                args: [subject, hyperedge.args[1]],
                truth: hyperedge.getTruth()
              });
            }
          });
        }
        else {
          const hyperedgeId = id('Inheritance', [subject, predicate]);
          const budget = this.nar.memoryManager.allocateResources({ type: 'question' }, { importance: 1.0, urgency: 1.0 });
          this.nar.propagation.propagate(hyperedgeId, 1.0, budget, 0, 0, []);
        }
      }

    } catch (e) {
      const promise = this.nar.state.questionPromises.get(questionId);
      if (promise) {
        clearTimeout(promise.timer);
        this.nar.state.questionPromises.delete(questionId);
        promise.reject(e);
      }
    }
  }

  _answerQuestion(questionId, answer) {
    const promise = this.nar.state.questionPromises.get(questionId);
    if (!promise) return;

    if (!promise.answered) {
        this.nar.learningEngine.recordExperience(
            { derivationPath: answer.derivationPath || ['answered'], target: questionId },
            { success: true, accuracy: answer.truth.expectation() }
        );
        promise.answered = true;
    }

    if (promise.options && promise.options.minExpectation &&
        answer.truth.expectation() >= promise.options.minExpectation) {
      clearTimeout(promise.timer);
      this.nar.state.questionPromises.delete(questionId);
      promise.resolve(answer);
      return;
    }

    if (!this.nar.state.index.questionCache.has(questionId)) {
      this.nar.state.index.questionCache.set(questionId, []);
    }
    this.nar.state.index.questionCache.get(questionId).push(answer);

    this.nar.emit('question-answer', { questionId, answer });
  }

  _resolveQuestion(questionId) {
    const answers = this.nar.state.index.questionCache.get(questionId) || [];
    if (answers.length === 0) return;

    const bestAnswer = answers.sort((a, b) =>
      b.truth.expectation() - a.truth.expectation())[0];

    const promise = this.nar.state.questionPromises.get(questionId);
    if (promise) {
      clearTimeout(promise.timer);
      this.nar.state.questionPromises.delete(questionId);
      promise.resolve(bestAnswer);
    }

    this.nar.state.index.questionCache.delete(questionId);
  }

  checkQuestionAnswers(hyperedgeId, belief) {
    const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
    if (!hyperedge) return;

    this.nar.state.questionPromises.forEach((_, questionId) => {
      const questionPattern = questionId.replace(/^Question\(|\)\|.*$/g, '');

      // First, try a direct string match for simple, non-variable questions.
      // This is more robust than relying on the parser for complex nested structures.
      if (!questionPattern.includes('$') && !questionPattern.includes('*') && questionPattern === hyperedgeId) {
          this._answerQuestion(questionId, {
              type: hyperedge.type,
              args: hyperedge.args,
              truth: belief.truth,
              derivationPath: belief.premises,
          });
          this.nar.learningEngine.recordSuccess?.(hyperedgeId);
          return; // Move to the next question
      }

      // Fallback to the parser-based logic for questions with variables/wildcards.
      try {
        const { type, args } = this.nar.expressionEvaluator.parse(questionPattern);

        if (type === hyperedge.type) {
          const matches = args.every((pattern, i) =>
            pattern === '*' ||
            pattern === hyperedge.args[i] ||
            (pattern.startsWith('$') && hyperedge.args[i] !== undefined)
          );

          if (matches) {
            this._answerQuestion(questionId, {
              type: hyperedge.type,
              args: hyperedge.args,
              truth: belief.truth,
              derivationPath: belief.premises,
            });
            this.nar.learningEngine.recordSuccess?.(hyperedgeId);
          }
        }
      } catch(e) {
          // Ignore parsing errors for patterns that don't match
      }
    });
  }
}
