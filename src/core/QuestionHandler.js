import { id, hash } from '../support/utils.js';

export class QuestionHandler {
  constructor(nar) {
    this.nar = nar;
    this.responseTimes = [];
  }

  ask(question, options = {}) {
    const questionId = this.generateQuestionId(question);
    const { timeout = this.nar.config.questionTimeout } = options;

    // Parse the question here to get the canonical target ID
    const { type, args } = this.nar.expressionEvaluator.parse(question.replace('?', ''));
    const targetId = id(type, args.map(arg => (arg && arg.args) ? arg.args[0] : arg));

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._cleanupQuestion(questionId);
        this.nar.learningEngine.recordExperience(
            { derivationPath: ['timeout'], target: questionId },
            { success: false }
        );
        reject(new Error(`Question timed out after ${timeout}ms: ${question}`));
      }, timeout);

      this.nar.state.questionPromises.set(questionId, { resolve, reject, timer, options, answered: false, startTime: Date.now(), targetId });

      // Index the question by its target ID
      if (!this.nar.state.questionsByTarget.has(targetId)) {
        this.nar.state.questionsByTarget.set(targetId, []);
      }
      this.nar.state.questionsByTarget.get(targetId).push(questionId);

      this._processQuestion(question, questionId, targetId, { type, args });
    });
  }

  generateQuestionId(question) {
    return `Question(${question})|${Date.now()}`;
  }

  _processQuestion(question, questionId, targetId, parsedQuestion) {
    try {
      const { type, args } = parsedQuestion;

      // Variable handling logic remains similar
      if (args.some(arg => typeof arg === 'string' && arg.startsWith('$'))) {
        // This part can be enhanced, for now, we focus on the main bug fix
        // For now, this logic will be simple and find direct matches
        // A more robust implementation would handle variables more dynamically
        return;
      }

      // For concrete questions, propagate activation towards the target
      const budget = this.nar.memoryManager.allocateResources({ type: 'question' }, { importance: 1.0, urgency: 1.0 });
      this.nar.propagation.propagate({
        target: targetId,
        activation: 1.0,
        budget: budget,
        pathHash: hash(String(targetId)),
        pathLength: 0,
        derivationPath: []
      });

    } catch (e) {
      const promise = this.nar.state.questionPromises.get(questionId);
      if (promise) {
        this._cleanupQuestion(questionId);
        promise.reject(e);
      }
    }
  }

  _cleanupQuestion(questionId) {
    const promise = this.nar.state.questionPromises.get(questionId);
    if (!promise) return;

    clearTimeout(promise.timer);

    // Remove from questionsByTarget index
    const targetQuestions = this.nar.state.questionsByTarget.get(promise.targetId);
    if (targetQuestions) {
        const index = targetQuestions.indexOf(questionId);
        if (index > -1) {
            targetQuestions.splice(index, 1);
        }
        if (targetQuestions.length === 0) {
            this.nar.state.questionsByTarget.delete(promise.targetId);
        }
    }

    // Remove from the main promise map
    this.nar.state.questionPromises.delete(questionId);
    this.nar.state.index.questionCache.delete(questionId);
  }

  _answerQuestion(questionId, answer) {
    const promise = this.nar.state.questionPromises.get(questionId);
    if (!promise || promise.answered) return;

    // Record learning experience only on the first answer
    this.nar.learningEngine.recordExperience(
        { derivationPath: answer.derivationPath || ['answered'], target: questionId },
        { success: true, accuracy: answer.truth.expectation() }
    );
    promise.answered = true;

    // Check if the answer meets the required expectation
    if (promise.options && promise.options.minExpectation &&
        answer.truth.expectation() >= promise.options.minExpectation) {

      this.responseTimes.push(Date.now() - promise.startTime);
      promise.resolve(answer);
      this._cleanupQuestion(questionId); // Clean up after resolving
      return;
    }

    // Cache answer if it doesn't meet expectation yet
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
      this.responseTimes.push(Date.now() - promise.startTime);
      promise.resolve(bestAnswer);
      this._cleanupQuestion(questionId);
    }
  }

  getAndResetQuestionResponseTimes() {
    const times = [...this.responseTimes];
    this.responseTimes = [];
    return times;
  }

  checkQuestionAnswers(hyperedgeId, belief) {
    const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
    if (!hyperedge) return;

    // Direct lookup using the new index
    const matchingQuestionIds = this.nar.state.questionsByTarget.get(hyperedgeId);

    if (matchingQuestionIds && matchingQuestionIds.length > 0) {
      const answer = {
        type: hyperedge.type,
        args: hyperedge.args,
        truth: belief.truth,
        derivationPath: belief.premises,
      };

      // Use slice() to create a copy, as _answerQuestion can modify the array
      matchingQuestionIds.slice().forEach(questionId => {
        this._answerQuestion(questionId, answer);
      });

      this.nar.learningEngine.recordSuccess?.(hyperedgeId);
    }
  }
}
