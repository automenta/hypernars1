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

    return {
      result,
      logs,
      name: test.name,
      description: test.description,
    };
  }
}