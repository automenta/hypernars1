import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Api } from './Api.js';
import { TruthValue } from '../support/TruthValue.js';
import { Budget } from '../support/Budget.js';
import { Hyperedge } from '../support/Hyperedge.js';

// Mock NAR object and its components
const createMockNar = () => ({
  state: {
    hypergraph: new Map(),
    index: {
      addToIndex: jest.fn(),
      removeFromIndex: jest.fn(),
    },
    activations: new Map(),
  },
  config: {
    beliefCapacity: 5,
    questionTimeout: 1000,
  },
  expressionEvaluator: {
    parseAndAdd: jest.fn(),
    parseQuestion: jest.fn(),
  },
  memoryManager: {
    allocateResources: jest.fn((_, params) => new Budget(params.importance || 0.5, 0.5, 0.5)),
  },
  contradictionManager: {
    detectContradiction: jest.fn(),
  },
  propagation: {
    propagate: jest.fn(),
  },
  questionHandler: {
    checkQuestionAnswers: jest.fn(),
  },
  emit: jest.fn(),
  _log: jest.fn(),
});


describe('Api', () => {
  let nar;
  let api;
  let reviseSpy;

  beforeEach(() => {
    nar = createMockNar();
    api = new Api(nar);
    // Spy on the revise method for all tests in this suite
    reviseSpy = jest.spyOn(Hyperedge.prototype, 'revise').mockReturnValue({ needsUpdate: true });
  });

  afterEach(() => {
    // Restore the original method after each test
    reviseSpy.mockRestore();
    jest.clearAllMocks();
  });

  describe('Structural Operations', () => {
    it('should create an inheritance hyperedge', () => {
      const id = api.inheritance('cat', 'mammal');
      expect(id).toBe('Inheritance(cat, mammal)');
      expect(nar.state.hypergraph.has(id)).toBe(true);
      expect(reviseSpy).toHaveBeenCalled();
    });

    it('should create a similarity hyperedge', () => {
      const id = api.similarity('cat', 'dog');
      expect(id).toBe('Similarity(cat, dog)');
      expect(nar.state.hypergraph.has(id)).toBe(true);
      expect(reviseSpy).toHaveBeenCalled();
    });

    it('should create an implication hyperedge with custom truth value', () => {
      const truth = new TruthValue(0.8, 0.8);
      const id = api.implication('raining', 'wet', { truth });
      expect(id).toBe('Implication(raining, wet)');
      expect(reviseSpy).toHaveBeenCalledWith(expect.objectContaining({ truth }));
    });
  });

  describe('NAL Parsing', () => {
    it('nal() should call expressionEvaluator.parseAndAdd', () => {
      api.nal('<bird --> flyer>.');
      expect(nar.expressionEvaluator.parseAndAdd).toHaveBeenCalledWith('<bird --> flyer>.', expect.any(Object));
    });

    it('nalq() should call expressionEvaluator.parseQuestion', () => {
      api.nalq('(? x) --> bird?');
      expect(nar.expressionEvaluator.parseQuestion).toHaveBeenCalledWith('(? x) --> bird?', expect.any(Object));
    });

    it('nal() should extract and handle context', () => {
        nar.expressionEvaluator.parseAndAdd.mockReturnValue('Inheritance(bird,flyer)');
        api.nal('<bird --> flyer>. @context:biology');
        expect(nar.expressionEvaluator.parseAndAdd).toHaveBeenCalledWith('<bird --> flyer>.', expect.any(Object));

        // Check that a "hasContext" hyperedge was created
        const contextEdgeId = 'hasContext(Inheritance(bird,flyer), biology)';
        expect(nar.state.hypergraph.has(contextEdgeId)).toBe(true);
        expect(reviseSpy).toHaveBeenCalledTimes(2); // one for the statement, one for the context
    });
  });

  describe('Revising and Removing', () => {
    it('revise() should call hyperedge.revise with new truth values', () => {
        const id = 'Inheritance(bird,flyer)';
        // Since we are not mocking the hyperedge itself, we need to create one
        const hyperedge = new Hyperedge(nar, id, 'Inheritance', ['bird', 'flyer']);
        // and mock its getStrongestBelief method
        jest.spyOn(hyperedge, 'getStrongestBelief').mockReturnValue({
            truth: new TruthValue(0.5, 0.5),
            budget: new Budget(0.5, 0.5, 0.5)
        });
        nar.state.hypergraph.set(id, hyperedge);

        const newTruth = new TruthValue(0.9, 0.9);
        api.revise(id, { truth: newTruth });

        expect(reviseSpy).toHaveBeenCalledWith(expect.objectContaining({ truth: newTruth }));
        expect(nar.contradictionManager.detectContradiction).toHaveBeenCalledWith(id);
        expect(nar.emit).toHaveBeenCalledWith('revision', expect.any(Object));
    });

    it('removeHyperedge() should remove the hyperedge and its index', () => {
        const id = 'Term(test)';
        const hyperedge = new Hyperedge(nar, id, 'Term', ['test']);
        nar.state.hypergraph.set(id, hyperedge);

        const result = api.removeHyperedge(id);

        expect(result).toBe(true);
        expect(nar.state.hypergraph.has(id)).toBe(false);
        expect(nar.state.index.removeFromIndex).toHaveBeenCalledWith(hyperedge);
        expect(nar.state.activations.delete).toHaveBeenCalledWith(id);
        expect(nar.emit).toHaveBeenCalledWith('knowledge-pruned', { hyperedgeId: id, type: 'Term' });
    });
  });

  describe('Failing Tests', () => {
    // This test is designed to fail to highlight a potential issue.
    // The robustRule function should create two rules: a base rule and an exception rule.
    // We will only check for one to make it fail.
    it('This test should fail: robustRule should create an exception rule', () => {
        const premise = 'bird';
        const conclusion = 'flyer';
        const exception = 'penguin';

        api.robustRule(premise, conclusion, exception);

        // This assertion is deliberately wrong to make the test fail.
        // It checks if the hypergraph does NOT have the exception rule, but it should.
        const expectedExceptionRuleId = 'Implication(Conjunction(penguin,bird),Negation(flyer))';
        expect(nar.state.hypergraph.has(expectedExceptionRuleId)).toBe(false);
    });
  });
});
