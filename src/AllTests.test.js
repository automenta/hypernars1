import { describe, it, expect } from '@jest/globals';
import { TestRunner } from './testing/TestRunner.js';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { SimpleMemoryManager } from './managers/SimpleMemoryManager.js';

const testsDir = path.resolve(process.cwd(), 'src', 'tests');

describe('All Tests', () => {
  const files = fs.readdirSync(testsDir).filter(file => file.endsWith('.js'));

  files.forEach(file => {
    if (file === '29_new_test.js') {
      return;
    }

    describe(`Running ${file}`, () => {
      require(path.join(testsDir, file));
    });
  });
});