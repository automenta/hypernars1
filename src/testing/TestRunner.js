import {NARHyper} from '../NARHyper.js';

export class TestRunner {
    constructor(config = {}) {
        this.nar = new NARHyper({...config, useAdvanced: true});
        this.logs = [];
        this.nar.on('log', (log) => {
            this.logs.push(log.message);
        });
    }

    run(test) {
        if (test.skipped) {
            return {result: true, logs: ['Test skipped']};
        }

        try {
            for (const step of test.steps) {
                if (step.action) {
                    step.action(this.nar);
                }

                if (step.assert) {
                    const assertResult = step.assert(this.nar, this.logs);
                    if (!assertResult) {
                        const stepName = step.comment || 'Unnamed step';
                        return {result: false, logs: [`[ASSERT FAILED] Step failed: ${stepName}`]};
                    }
                }
            }
            return {result: true, logs: this.logs};
        } catch (error) {
            return {result: false, logs: [error.stack]};
        }
    }
}
