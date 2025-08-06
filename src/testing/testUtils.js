import {NAR} from '../NAR.js';

export function generateBeliefs(count) {
    const beliefs = [];
    for (let i = 0; i < count; i++) {
        beliefs.push(`(<concept_${i} --> property_${i}>).`);
    }
    return beliefs;
}

export function runWithTiming(nar, cycles) {
    const startTime = performance.now();
    nar.run(cycles);
    const endTime = performance.now();
    return endTime - startTime;
}

export function createTestNar(config = {}) {
    return new NAR({useAdvanced: true, ...config});
}
