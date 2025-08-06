import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import {NAR} from '../NAR.js';
import {TruthValue} from '../support/TruthValue.js';


jest.useFakeTimers();

describe('QuestionHandler', () => {
    let nar;
    let questionHandler;

    beforeEach(() => {
        nar = new NAR({useAdvanced: true});
        questionHandler = nar.questionHandler;
    });

    it('should add an event to the queue when a belief is added', () => {
        expect(nar.state.eventQueue.heap.length).toBe(0);
        nar.inheritance('sky', 'blue', { truth: new TruthValue(1.0, 0.9) });
        expect(nar.state.eventQueue.heap.length).toBe(1);
        const event = nar.state.eventQueue.pop();
        expect(event.target).toBe('Inheritance(sky, blue)');
    });

    it('should answer a question when a corresponding belief is added', async () => {
        const question = '<sky --> blue>?';
        const answerPromise = questionHandler.ask(question, {minExpectation: 0.8});


        expect(nar.state.questionPromises.size).toBe(1);


        nar.inheritance('sky', 'blue', { truth: new TruthValue(1.0, 0.9) });


        for (let i = 0; i < 5; i++) {
            nar.step();
        }


        await expect(answerPromise).resolves.toMatchObject({
            type: 'Inheritance',
            args: ['sky', 'blue'],
        });


        expect(nar.state.questionPromises.size).toBe(0);
    });

    it('should reject the promise on timeout', async () => {
        const question = '<moon --> cheese>?';
        const answerPromise = questionHandler.ask(question, {timeout: 100});


        jest.runOnlyPendingTimers();

        await expect(answerPromise).rejects.toThrow('Question timed out after 100ms: <moon --> cheese>?');
    });
});
