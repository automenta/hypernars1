import { beforeEach, describe, expect, it } from '@jest/globals';
import { Hyperedge } from './Hyperedge.js';
import { TruthValue } from './TruthValue.js';
import { Budget } from './Budget.js';
import { NAR } from '../NAR.js';

describe('Hyperedge', () => {
    let nar;
    let hyperedge;

    beforeEach(() => {
        nar = new NAR({ useAdvanced: true });
        hyperedge = new Hyperedge(nar, 'test_id', 'Test', ['arg1', 'arg2']);
    });

    describe('revise', () => {
        it('should add a new belief if none exist', () => {
            const truth = new TruthValue(0.8, 0.9);
            const budget = new Budget(0.5, 0.6, 0.7);
            hyperedge.revise({ truth, budget });
            expect(hyperedge.beliefs).toHaveLength(1);
            expect(hyperedge.beliefs[0].truth).toBe(truth);
            expect(hyperedge.beliefs[0].budget).toBe(budget);
        });

        it('should add a new belief to an existing hyperedge', () => {
            const truth1 = new TruthValue(0.5, 0.9);
            const budget1 = new Budget(0.5, 0.9, 0.9);
            hyperedge.revise({ truth: truth1, budget: budget1 });

            const truth2 = new TruthValue(0.8, 0.9);
            const budget2 = new Budget(0.8, 0.9, 0.9);
            hyperedge.revise({ truth: truth2, budget: budget2 });

            expect(hyperedge.beliefs).toHaveLength(2);
        });
    });

    describe('getters', () => {
        it('getStrongestBelief should return the belief with the highest priority', () => {
            const truth1 = new TruthValue(0.5, 0.9);
            const budget1 = new Budget(0.5, 0.9, 0.9);
            hyperedge.revise({ truth: truth1, budget: budget1 });

            const truth2 = new TruthValue(0.8, 0.9);
            const budget2 = new Budget(0.8, 0.9, 0.9);
            hyperedge.revise({ truth: truth2, budget: budget2 });

            expect(hyperedge.getStrongestBelief().budget.priority).toBe(0.8);
        });

        it('getTruth should return the truth of the strongest belief', () => {
            const truth1 = new TruthValue(0.5, 0.9);
            const budget1 = new Budget(0.5, 0.9, 0.9);
            hyperedge.revise({ truth: truth1, budget: budget1 });

            const truth2 = new TruthValue(0.8, 0.9);
            const budget2 = new Budget(0.8, 0.9, 0.9);
            hyperedge.revise({ truth: truth2, budget: budget2 });

            expect(hyperedge.getTruth().frequency).toBe(0.8);
            expect(hyperedge.getTruth().confidence).toBe(0.9);
        });

        it('getTruth should return unknown truth if no beliefs', () => {
            const unknown = TruthValue.unknown();
            const truth = hyperedge.getTruth();
            expect(truth.frequency).toBe(unknown.frequency);
            expect(truth.confidence).toBe(unknown.confidence);
        });

        it('getTruthExpectation should return the expectation of the strongest belief', () => {
            const truth = new TruthValue(0.8, 0.9);
            const budget = new Budget(0.5, 0.6, 0.7);
            hyperedge.revise({ truth, budget });
            expect(hyperedge.getTruthExpectation()).toBe(truth.expectation());
        });

        it('getTruthExpectation should return 0.5 if no beliefs', () => {
            expect(hyperedge.getTruthExpectation()).toBe(0.5);
        });
    });

    describe('toJSON', () => {
        it('should return a JSON serializable representation', () => {
            const truth = new TruthValue(0.8, 0.9);
            const budget = new Budget(0.5, 0.6, 0.7);
            hyperedge.revise({ truth, budget });

            const json = hyperedge.toJSON();
            expect(json.id).toBe('test_id');
            expect(json.type).toBe('Test');
            expect(json.args).toEqual(['arg1', 'arg2']);
            expect(json.beliefs).toHaveLength(1);
            expect(json.beliefs[0].truth.frequency).toBe(0.8);
            expect(json.beliefs[0].budget.priority).toBe(0.5);
        });
    });
});
