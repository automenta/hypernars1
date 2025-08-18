/**
 * TestAnalyzer provides a static analysis of test failures.
 */
export class TestAnalyzer {
    /**
     * Analyzes a test failure and returns a report.
     * @param {Error} error - The error object from the test failure.
     * @param {NAR} nar - The NAR instance at the time of failure.
     * @param {object} step - The test step that failed.
     * @param {string[]} logs - The logs from the test execution.
     * @returns {string} - The analysis report.
     */
    static analyze(error, nar, step, logs) {
        const report = [
            '=================================================',
            '          Test Failure Analysis Report           ',
            '=================================================',
            `Failure in step: "${step.comment || 'Unnamed step'}"`,
            `Reason: ${error.message.split('\\n')[0]}`,
            '-------------------------------------------------',
            'Static Analysis:',
            this.analyzeStep(step),
            '-------------------------------------------------',
            'Runtime Analysis:',
            this.analyzeLogs(logs),
            '=================================================',
        ];
        return report.join('\n');
    }

    /**
     * Statically analyzes the failed test step.
     * @param {object} step - The test step that failed.
     * @returns {string} - The static analysis report.
     */
    static analyzeStep(step) {
        if (!step.assert) {
            return 'No assertion found in the failed step.';
        }
        const assertText = step.assert.toString();
        return `Assertion logic:\n${assertText}`;
    }

    /**
     * Analyzes the logs from the test execution.
     * @param {string[]} logs - The logs from the test execution.
     * @returns {string} - The log analysis report.
     */
    static analyzeLogs(logs) {
        if (logs.length === 0) {
            return 'No logs were captured during the test execution.';
        }
        const recentLogs = logs.slice(-10); // Get the last 10 logs
        return `Recent Logs (last ${recentLogs.length}):\n${recentLogs.join('\n')}`;
    }
}
