import { describe, it } from '@jest/globals';
import { TestRunner } from './testing/TestRunner.js';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';

const testRunner = new TestRunner();
const testsDir = path.resolve(process.cwd(), 'src', 'tests');

describe('All Tests', () => {
  const files = fs.readdirSync(testsDir).filter(file => file.endsWith('.js'));

  files.forEach(file => {
    it(`runs ${file}`, async () => {
      const testPath = path.join(testsDir, file);
      const testModule = await import(pathToFileURL(testPath));
      const test = testModule.default;

      const { result, logs, name, description } = testRunner.run(test);

      console.log(`\n===== Running Test: ${name} =====`);
      console.log(`  ${description}`);
      console.log('\n--- Logs ---');
      logs.forEach(l => console.log(l));
      console.log('--- End Logs ---\n');

      // TODO: Add assertions here
    });
  });
});
