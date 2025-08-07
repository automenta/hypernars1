import {describe, expect, it, beforeEach} from '@jest/globals';
import {NAR} from '../NAR.js';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

export function runAllTests() {
    const testsDir = path.resolve(process.cwd(), 'src', 'tests');
    const files = fs.readdirSync(testsDir).filter(file => (file.endsWith('.js') || file.endsWith('.test.js')) && file !== 'adapter.js');

    describe('All Tests', () => {
        for (const file of files) {
            describe(`Tests from ${file}`, () => {
                it(`should load and run tests from ${file}`, async () => {
                    const modulePath = path.join(testsDir, file);
                    const testModule = await import(pathToFileURL(modulePath));

                    if (!testModule || !testModule.default) {
                        return;
                    }

                    const tests = Array.isArray(testModule.default) ? testModule.default : [testModule.default];

                    for (const test of tests) {
                        if (!test || !test.steps) {
                            continue;
                        }

                        const testName = test.name || file;
                        // Since we are already in an `it` block, we can't use `describe` here.
                        // We will just run the test steps.
                        // If we want nested describes, we would need a more complex setup.

                        let nar;
                        let logs;

                        nar = new NAR({...test.config, useAdvanced: true});
                        logs = [];
                        nar.on('log', (log) => {
                            logs.push(log.message);
                        });

                        for (const step of test.steps) {
                            if (step.action) {
                                step.action(nar);
                            }

                            if (step.assert) {
                                const assertResult = step.assert(nar, logs);
                                if (assertResult !== true) {
                                    const errorMessage = `Assertion failed in step: "${step.comment || 'unnamed'}" of test "${testName}"\nLogs:\n${logs.join('\n')}`;
                                    expect(assertResult).toBe(true, errorMessage);
                                } else {
                                    expect(assertResult).toBe(true);
                                }
                            }
                        }
                    }
                });
            });
        }
    });
}