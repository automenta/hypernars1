import {hash, id} from '../support/utils.js';

export class QuestionHandler {
    constructor(nar) {
        this.nar = nar;
        this.responseTimes = [];
        this.questionPromises = new Map();
    }

    ask(question, options = {}) {
        const questionId = this.generateQuestionId(question);
        const {timeout = this.nar.config.questionTimeout} = options;

        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.questionPromises.delete(questionId);
                this.nar.learningEngine.recordExperience(
                    {derivationPath: ['timeout'], target: questionId},
                    {success: false}
                );
                reject(new Error(`Question timed out after ${timeout}ms: ${question}`));
            }, timeout);

            const promiseData = {
                resolve,
                reject,
                timer,
                options,
                answered: false,
                startTime: Date.now(),
                parsedQuestion: null // Will be populated by _processQuestion
            };
            this.questionPromises.set(questionId, promiseData);
            this._processQuestion(question, questionId);
        });
    }

    generateQuestionId(question) {
        return `Question(${question})|${Date.now()}`;
    }

    _processQuestion(question, questionId) {
        try {
            const parsedQuestion = this.nar.expressionEvaluator.parse(question.replace('?', ''));
            const promise = this.questionPromises.get(questionId);
            if (promise) {
                promise.parsedQuestion = parsedQuestion;
            }

            switch (parsedQuestion.type) {
                case 'Inheritance':
                    this._processInheritanceQuestion(parsedQuestion, questionId);
                    break;
                default:
                    const hyperedgeId = id(parsedQuestion.type, parsedQuestion.args);
                    const budget = this.nar.memoryManager.allocateResources({type: 'question'}, {
                        importance: 1.0,
                        urgency: 1.0
                    });
                    this.nar.propagation.propagate({
                        target: hyperedgeId,
                        activation: 1.0,
                        budget: budget,
                        pathHash: hash(String(hyperedgeId)),
                        pathLength: 0,
                        derivationPath: []
                    });
                    break;
            }
        } catch (e) {
            const promise = this.questionPromises.get(questionId);
            if (promise) {
                clearTimeout(promise.timer);
                this.questionPromises.delete(questionId);
                promise.reject(e);
            }
        }
    }

    _processInheritanceQuestion({args}, questionId) {
        const subject = (args[0] && args[0].args) ? args[0].args[0] : args[0];
        const predicate = (args[1] && args[1].args) ? args[1].args[0] : args[1];

        if (typeof subject === 'string' && subject.startsWith('$')) {
            this._handleVariableQuestion(questionId, predicate, 1, (hyperedge) => [hyperedge.args[0], predicate]);
        } else if (typeof predicate === 'string' && predicate.startsWith('$')) {
            this._handleVariableQuestion(questionId, subject, 0, (hyperedge) => [subject, hyperedge.args[1]]);
        } else {
            const hyperedgeId = id('Inheritance', [subject, predicate]);
            const budget = this.nar.memoryManager.allocateResources({type: 'question'}, {importance: 1.0, urgency: 1.0});
            this.nar.propagation.propagate({
                target: hyperedgeId,
                activation: 1.0,
                budget: budget,
                pathHash: hash(String(hyperedgeId)),
                pathLength: 0,
                derivationPath: []
            });
        }
    }

    _handleVariableQuestion(questionId, constantTerm, termIndex, answerBuilder) {
        const relatedHyperedges = this.nar.state.index.byArg.get(constantTerm) || new Set();
        relatedHyperedges.forEach(hyperedgeId => {
            const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
            if (hyperedge?.type === 'Inheritance' && hyperedge.args[termIndex] === constantTerm) {
                this._answerQuestion(questionId, {
                    type: 'Inheritance',
                    args: answerBuilder(hyperedge),
                    truth: hyperedge.getTruth()
                });
            }
        });
    }

    _answerQuestion(questionId, answer) {
        const promise = this.questionPromises.get(questionId);
        if (!promise) return;

        if (!promise.answered) {
            this.nar.learningEngine.recordExperience(
                {derivationPath: answer.derivationPath || ['answered'], target: questionId},
                {success: true, accuracy: answer.truth.expectation()}
            );
            promise.answered = true;
        }

        if (promise.options && promise.options.minExpectation &&
            answer.truth.expectation() >= promise.options.minExpectation) {
            clearTimeout(promise.timer);
            this.questionPromises.delete(questionId);
            this.responseTimes.push(Date.now() - promise.startTime);
            promise.resolve(answer);
            return;
        }

        if (!this.nar.state.index.questionCache.has(questionId)) {
            this.nar.state.index.questionCache.set(questionId, []);
        }
        this.nar.state.index.questionCache.get(questionId).push(answer);

        this.nar.emit('question-answer', {questionId, answer});
    }

    _resolveQuestion(questionId) {
        const answers = this.nar.state.index.questionCache.get(questionId) || [];
        if (answers.length === 0) return;

        const bestAnswer = answers.sort((a, b) =>
            b.truth.expectation() - a.truth.expectation())[0];

        const promise = this.questionPromises.get(questionId);
        if (promise) {
            clearTimeout(promise.timer);
            this.questionPromises.delete(questionId);
            this.responseTimes.push(Date.now() - promise.startTime);
            promise.resolve(bestAnswer);
        }

        this.nar.state.index.questionCache.delete(questionId);
    }

    getAndResetQuestionResponseTimes() {
        const times = [...this.responseTimes];
        this.responseTimes = [];
        return times;
    }

    checkQuestionAnswers(hyperedgeId, belief) {
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        if (!hyperedge) return;

        this.questionPromises.forEach((promise, questionId) => {
            if (!promise.parsedQuestion) return;

            const parsedQuestion = promise.parsedQuestion;
            const questionHyperedgeId = id(parsedQuestion.type, parsedQuestion.args.map(a => (a && a.args) ? a.args[0] : a));

            if (questionHyperedgeId === hyperedgeId) {
                this._answerQuestion(questionId, {
                    type: hyperedge.type,
                    args: hyperedge.args,
                    truth: belief.truth,
                    derivationPath: belief.premises,
                });
                this.nar.learningEngine.recordSuccess?.(hyperedgeId);
            }
        });
    }
}
