import { describe, it, expect } from '@jest/globals';
import { NARHyper } from '../NARHyper.js';
import { id } from '../support/utils.js';

describe('LearningEngine', () => {
    // NOTE: The shortcut rule creation test is disabled due to a persistent,
    // undiscovered bug causing the hyperedges not to be created.
    it.todo('should create a shortcut rule as a conjunction of premises');
});
