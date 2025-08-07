import { createTestNar } from '../testing/testUtils.js';
import { SimpleMemoryManager } from '../managers/SimpleMemoryManager.js';
import { AdvancedMemoryManager } from '../managers/AdvancedMemoryManager.js';

// This test is structured differently as it needs to run the same logic
// against different NAR instances. The standard TestRunner won't work here.
// Instead, we will do the setup and assertion within each step.

export default {
    name: '14. Configuration Matrix',
    description: 'Tests core logic with different component configurations.',
    skipped: false, // SKIPPED: Uncovered potential bug where SimpleMemoryManager is not compatible with the Api layer.
    steps: [
        {
            comment: 'Test basic inference with SimpleMemoryManager.',
            // We don't use the 'nar' passed by the TestRunner here.
            action: (nar) => {
                const simpleNar = createTestNar({
                    modules: { MemoryManager: SimpleMemoryManager },
                });
                simpleNar.nal('<a --> b>.');
                simpleNar.nal('<b --> c>.');
                simpleNar.run(20);
                nar.scratchpad = { narInstance: simpleNar }; // Pass the instance to the assert step
            },
            assert: (nar, logs) => {
                const simpleNar = nar.scratchpad.narInstance;
                const beliefId = simpleNar.inheritance('a', 'c');
                const belief = simpleNar.getBeliefs(beliefId)[0];
                return belief && belief.truth.confidence > 0.5;
            },
        },
        {
            comment: 'Test basic inference with AdvancedMemoryManager.',
            action: (nar) => {
                const advancedNar = createTestNar({
                    modules: { MemoryManager: AdvancedMemoryManager },
                });
                advancedNar.nal('<a --> b>.');
                advancedNar.nal('<b --> c>.');
                advancedNar.run(20);
                nar.scratchpad = { narInstance: advancedNar };
            },
            assert: (nar, logs) => {
                const advancedNar = nar.scratchpad.narInstance;
                const beliefId = advancedNar.inheritance('a', 'c');
                const belief = advancedNar.getBeliefs(beliefId)[0];
                return belief && belief.truth.confidence > 0.5;
            },
        },
    ],
};
