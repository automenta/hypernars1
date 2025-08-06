import { NAR } from '../NAR.js';

// Manually import all test files
import test01 from '../tests/01_basic_inference.js';
import test02 from '../tests/02_contradiction.js';
// Add more test imports as needed

const testFiles = [
  test01,
  test02,
  // Add more tests here
];

testFiles.forEach(test => {
  const testName = test.name || 'Anonymous Test';
  
  describe(testName, () => {
    test.steps.forEach((step, index) => {
      it(`Step ${index + 1}`, async () => {
        const nar = new NAR();
        await step.action(nar);
        await nar.run(50);
        
        const result = step.assert(nar, []);
        expect(result).toBe(true);
      });
    });
  });
});