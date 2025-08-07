import {beforeEach, describe, it} from '@jest/globals';
import {NAR} from './NAR.js';
import fs from 'fs';
import path from 'path';
import {pathToFileURL} from 'url';

const testsDir = path.resolve(process.cwd(), 'src', 'tests');
const files = fs.readdirSync(testsDir).filter(file => file.endsWith('.js') && !file.endsWith('.test.js'));

async function loadTestModules() {
    const testModules = [];
    for (const file of files) {
        if (file === '29_new_test.js') {
            continue;
        }
        const modulePath = path.join(testsDir, file);
        try {
            const testModule = await import(pathToFileURL(modulePath));
            testModules.push({file, testModule});
        } catch (error) {
            // Create a placeholder to report the error during test execution
            testModules.push({file, error});
        }
    }
    return testModules;
}

const testModules = await loadTestModules();

describe('All Tests', () => {
    testModules.forEach(({file, testModule, error}) => {
        if (error) {
            it(`should import test file ${file} successfully`, () => {
                throw new Error(`Failed to import test file: ${file}\n${error.stack}`);
            });
            return;
        }

        if (!testModule || !testModule.default) {
            return;
        }

        const tests = Array.isArray(testModule.default) ? testModule.default : [testModule.default];

        describe(`Tests from ${file}`, () => {
            tests.forEach(test => {
                if (!test || !test.steps) {
                    return;
                }

                const testName = test.name || file;
                const describeBlock = test.skipped ? describe.skip : describe;

                describeBlock(testName, () => {
                    const nar = new NAR({...test.config, useAdvanced: true});
                    let logs;

                    beforeEach(() => {
                        nar.clearState();
                        nar.removeAllListeners('log');
                        logs = [];
                        nar.on('log', (log) => {
                            logs.push(log.message);
                        });
                    });

                    test.steps.forEach((step, index) => {
                        const stepName = step.comment || `Step ${index + 1}`;
                        const itBlock = step.skipped ? it.skip : it;

                        itBlock(stepName, () => {
                            if (step.action) {
                                step.action(nar);
                            }

                            if (step.assert) {
                                const assertResult = step.assert(nar, logs);
                                if (assertResult !== true) {
                                    const errorMessage = `Assertion failed in step: "${stepName}"\nREASON: ${assertResult}\n\nLOGS:\n${logs.join('\n')}`;
                                    throw new Error(errorMessage);
                                }
                            }
                        });
                    });
                });
            });
        });
    });
});
