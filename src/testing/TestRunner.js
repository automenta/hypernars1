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

    const nar = new NARHyper({ ...this.config, logger: logger.info });

    for (const step of test.steps) {
        if (step.action) {
            step.action(nar);
        }

        if (step.assert) {
            const success = step.assert(nar, logs);
            if (!success) {
                return {
                    result: false,
                    logs,
                    name: test.name,
                    description: test.description,
                    nar,
                };
            }
        }
    }

    return {
        result: true,
        logs,
        name: test.name,
        description: test.description,
        nar,
    };
  }
}