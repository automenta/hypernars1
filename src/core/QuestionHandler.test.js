import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import {NAR} from '../NAR.js';
import {TruthValue} from '../support/TruthValue.js';

// Mock setTimeout and clearTimeout
jest.useFakeTimers();

describe('QuestionHandler', () => {
    let nar;
    let questionHandler;

    beforeEach(() => {
        nar = new NAR();
        questionHandler = nar.questionHandler;
    });

    it('should answer a question when a corresponding belief is added', async () => {
        const question = '<sky --> blue>?';
        const answerPromise = questionHandler.ask(question, {minExpectation: 0.8});

        // The question is pending, no answer yet
        expect(nar.state.questionPromises.size).toBe(1);

        // Add a belief that answers the question
        const hyperedgeId = nar.inheritance('sky', 'blue');
        const belief = {
            id: 'belief1',
            truth: new TruthValue(1.0, 0.9),
            premises: [],
        };
        nar.state.hypergraph.get(hyperedgeId).beliefs.push(belief);
        questionHandler.checkQuestionAnswers(hyperedgeId, belief);

        // The promise should resolve with the answer
        await expect(answerPromise).resolves.toEqual({
            type: 'Inheritance',
            args: ['sky', 'blue'],
            truth: belief.truth,
            derivationPath: [],
        });

        // The question should be removed from the pending list
        expect(nar.state.questionPromises.size).toBe(0);
    });

    it('should reject the promise on timeout', async () => {
        const question = '<moon --> cheese>?';
        const answerPromise = questionHandler.ask(question, {timeout: 100});

        // Fast-forward time
        jest.runAllTimers();

        await expect(answerPromise).rejects.toThrow('Question timed out after 100ms: <moon --> cheese>?');
    });
});
