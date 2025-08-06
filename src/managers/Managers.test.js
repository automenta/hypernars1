import {describe, expect, it} from '@jest/globals';
import {NAR} from '../NAR.js';
import {AdvancedContradictionManager} from './AdvancedContradictionManager.js';
import {SimpleContradictionManager} from './SimpleContradictionManager.js';
import {AdvancedLearningEngine} from './AdvancedLearningEngine.js';
import {SimpleLearningEngine} from './SimpleLearningEngine.js';
import {AdvancedMemoryManager} from './AdvancedMemoryManager.js';
import {SimpleMemoryManager} from './SimpleMemoryManager.js';

describe('NARHyper Manager Dependency Injection', () => {
    it('should use Simple managers by default', () => {
        const nar = new NAR();
        expect(nar.contradictionManager).toBeInstanceOf(SimpleContradictionManager);
        expect(nar.learningEngine).toBeInstanceOf(SimpleLearningEngine);
        expect(nar.memoryManager).toBeInstanceOf(SimpleMemoryManager);
    });

    it('should use Advanced managers when configured', () => {
        const nar = new NAR({useAdvanced: true});
        expect(nar.contradictionManager).toBeInstanceOf(AdvancedContradictionManager);
        expect(nar.learningEngine).toBeInstanceOf(AdvancedLearningEngine);
        expect(nar.memoryManager).toBeInstanceOf(AdvancedMemoryManager);
    });

    it('should allow overriding specific modules', () => {
        const nar = new NAR({
            useAdvanced: true,
            modules: {

                LearningEngine: SimpleLearningEngine,
            }
        });
        expect(nar.contradictionManager).toBeInstanceOf(AdvancedContradictionManager);
        expect(nar.learningEngine).toBeInstanceOf(SimpleLearningEngine);
        expect(nar.memoryManager).toBeInstanceOf(AdvancedMemoryManager);
    });
});