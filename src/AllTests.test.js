import { describe, it, expect } from '@jest/globals';
import { TestRunner } from './testing/TestRunner.js';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';

const testRunner = new TestRunner({ useAdvanced: true });
const testsDir = path.resolve(process.cwd(), 'src', 'tests');

describe('All Tests', () => {
  const files = fs.readdirSync(testsDir).filter(file => file.endsWith('.js'));

  files.forEach(file => {
    it(`runs ${file}`, async () => {
      const testPath = path.join(testsDir, file);
      const testModule = await import(pathToFileURL(testPath));
      const tests = Array.isArray(testModule.default) ? testModule.default : [testModule.default];

      for (const test of tests) {
        if (test.skipped) {
          console.warn(`[SKIPPED] ${test.name}: ${test.description}`);
          continue; // Skip to the next test in the array
        }

        const { result, logs, name, description } = testRunner.run(test);

        if (!result) {
          console.error(`\n--- Test Failed: ${name} ---`);
          console.error(`  ${description}`);
          console.error('\n--- Logs ---');
          logs.forEach(l => console.error(l));
          console.error('--- End Logs ---\n');
        }

        expect(result).toBe(true);
      }
    });
  });
});