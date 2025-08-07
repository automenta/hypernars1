import { describe, expect, it } from '@jest/globals';
import { NAR } from './NAR.js';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const testsDir = path.resolve(process.cwd(), 'src', 'tests-custom');
const files = fs.readdirSync(testsDir).filter((file) => file.endsWith('.js'));

describe('Custom NAR Tests', () => {
    for (const file of files) {
        // Create a test case for each file. The async logic will be inside.
        it(`should successfully run tests from ${file}`, async () => {
            const modulePath = path.join(testsDir, file);
            let testModule;

            try {
                testModule = await import(pathToFileURL(modulePath));
            } catch (error) {
                // Fail the test if the module can't be imported
                throw new Error(
                    `Failed to import test file: ${file}\n${error.stack}`
                );
            }

            // If the file doesn't have a default export, it's not a test file.
            if (!testModule || !testModule.default) {
                // This can be considered a passing case for a non-test file.
                return;
            }

            const tests = Array.isArray(testModule.default)
                ? testModule.default
                : [testModule.default];

            for (const test of tests) {
                if (!test || !test.steps) continue;

                const testName = test.name || file;

                // Setup NAR instance for each test object
                const nar = new NAR({ ...test.config, useAdvanced: true });
                const logs = [];
                nar.on('log', (log) => {
                    logs.push(log.message);
                });

                // Execute each step
                for (const [index, step] of test.steps.entries()) {
                    const stepName = step.comment || `Step ${index + 1}`;

                    if (step.skipped) continue;

                    if (step.action) {
                        step.action(nar);
                    }

                    if (step.assert) {
                        const assertResult = step.assert(nar, logs);
                        if (assertResult !== true) {
                            // Provide a detailed error message for failed assertions
                            const errorMessage = `Assertion failed in test "${testName}" -> step "${stepName}"\nLogs:\n${logs.join('\n')}`;
                            expect(assertResult).toBe(true, errorMessage);
                        } else {
                            // Explicitly pass the test on success
                            expect(assertResult).toBe(true);
                        }
                    }
                }
            }
        });
    }
});
