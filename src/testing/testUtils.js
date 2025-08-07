import { NAR } from '../NAR.js';

/**
 * Generates an array of simple Narsese belief statements.
 * @param {number} count - The number of beliefs to generate.
 * @returns {string[]} An array of Narsese statements.
 */
export function generateBeliefs(count) {
    const beliefs = [];
    for (let i = 0; i < count; i++) {
        beliefs.push(`(<concept_${i} --> property_${i}>).`);
    }
    return beliefs;
}

/**
 * Runs the NAR system for a specified number of cycles and measures execution time.
 * @param {NAR} nar - The NARHyper instance to run.
 * @param {number} cycles - The number of cycles to run.
 * @returns {number} The execution time in milliseconds.
 */
export function runWithTiming(nar, cycles) {
    const startTime = performance.now();
    nar.run(cycles);
    const endTime = performance.now();
    return endTime - startTime;
}

/**
 * Creates a new NARHyper instance with a given configuration.
 * @param {object} config - The configuration object for NARHyper.
 * @returns {NAR} A new NARHyper instance.
 */
export function createTestNar(config = {}) {
    return new NAR({ useAdvanced: true, ...config });
}
