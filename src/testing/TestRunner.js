import { NARHyper } from '../NARHyper.js';

export class TestRunner {
  constructor(config = {}) {
    this.config = config;
  }

  run(test) {
    const logs = [];
    const logger = {
      info: (message) => {
        const logMessage = `[INFO] ${new Date().toISOString()}: ${message}`;
        logs.push(logMessage);
      },
      warn: (message) => {
        const logMessage = `[WARN] ${new Date().toISOString()}: ${message}`;
        logs.push(logMessage);
      },
      error: (message) => {
        const logMessage = `[ERROR] ${new Date().toISOString()}: ${message}`;
        logs.push(logMessage);
      },
    };

    // For backward compatibility with tests that just use `log(message)`
    const log = logger.info;
    Object.assign(log, logger);

    const nar = new NARHyper(this.config);
    const result = test.run(nar, log);
    const assertionErrors = [];

    if (test.assert) {
      const expect = (actual) => ({
        toBe: (expected) => {
          if (actual !== expected) {
            assertionErrors.push(`Expected ${JSON.stringify(actual)} to be ${JSON.stringify(expected)}`);
          }
        },
        toBeGreaterThan: (expected) => {
          if (actual <= expected) {
            assertionErrors.push(`Expected ${actual} to be greater than ${expected}`);
          }
        },
        toBeLessThan: (expected) => {
          if (actual >= expected) {
            assertionErrors.push(`Expected ${actual} to be less than ${expected}`);
          }
        },
        toBeDefined: () => {
          if (actual === undefined || actual === null) {
            assertionErrors.push(`Expected value to be defined, but it was ${actual}`);
          }
        },
        toContain: (expected) => {
          if (!actual.includes(expected)) {
            assertionErrors.push(`Expected ${JSON.stringify(actual)} to contain ${JSON.stringify(expected)}`);
          }
        },
        toHaveLength: (expected) => {
          if (actual.length !== expected) {
            assertionErrors.push(`Expected length to be ${expected}, but was ${actual.length}`);
          }
        },
      });

      try {
        test.assert(nar, logs, { expect });
      } catch (e) {
        assertionErrors.push(`Assertion function threw an error: ${e.message}`);
      }
    }

    return {
      result,
      logs,
      name: test.name,
      description: test.description,
      assertionErrors,
    };
  }
}