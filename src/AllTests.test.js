import { describe, it, expect } from '@jest/globals';
import { TestRunner } from './testing/TestRunner.js';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';

const testsDir = path.resolve(process.cwd(), 'src', 'tests');

describe('All Tests', () => {
  const files = fs.readdirSync(testsDir).filter(file => file.endsWith('.js'));

  files.forEach(file => {
    if (file === '29_new_test.js') {
      return;
    }

    it(`should run tests from ${file} successfully`, async () => {
      const modulePath = path.join(testsDir, file);
      const testModule = await import(pathToFileURL(modulePath));
      const tests = Array.isArray(testModule.default) ? testModule.default : [testModule.default];

      for (const test of tests) {
        if (test.skipped) {
            console.log(`Skipping test: ${test.name}`);
            continue;
        }

        const runner = new TestRunner({ useAdvanced: true, ...test.config });
        const result = runner.run(test);

        if (!result.result) {
          // Log details if the test fails
          console.log(`Test Failed: ${test.name || 'Unnamed test'}`);
          console.log(`Description: ${test.description || 'No description'}`);
          console.log('Logs:', result.logs.join('\n'));
        }

        const expected = test.expectedResult === undefined ? true : test.expectedResult;
        expect(result.result).toBe(expected);
      }
    });
  });
});