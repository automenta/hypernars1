export default {
    name: '53. Meta-Reasoning & Self-Optimization',
    description: 'Tests for adaptive strategies and self-monitoring.',
    steps: [
        {
            name: 'Configure a reasoning strategy',
            action: (nar) => {
                // Assuming the API from enhance.a.md is implemented.
                // Configure a "cautious" strategy for high-uncertainty contexts.
                nar.meta.configureStrategy({
                    context: 'high-uncertainty',
                    strategy: 'cautious',
                    priority: 1.0
                });
                nar.meta.configureStrategy({
                    context: 'default',
                    strategy: 'balanced',
                    priority: 0.1
                });
                nar.run(5);
            },
            assert: (nar) => {
                // Check if the strategy configuration is stored.
                // This is an internal check and depends on implementation.
                return nar.meta.strategies && nar.meta.strategies.length === 2;
            }
        },
        {
            name: 'Get active strategy based on context',
            action: (nar) => {
                // Manually set the system's internal context for testing purposes.
                // Assumes an internal method to do this.
                nar.meta._setInternalContext(['high-uncertainty', 'low-resources']);
            },
            assert: (nar) => {
                // Check if the system correctly identifies and returns the active strategy.
                const activeStrategy = nar.meta.getActiveStrategy();
                return activeStrategy === 'cautious';
            }
        },
        {
            name: 'Check self-monitoring metrics',
            action: (nar) => {
                // Perform some actions to generate metrics.
                nar.nal('(a --> b).');
                nar.nal('(b --> c).');
                nar.nalq('(a --> c)?');
                nar.run(20);
            },
            assert: (nar) => {
                // The self-monitor function should return a set of metrics.
                const report = nar.meta.selfMonitor();
                return report &&
                       report.metrics &&
                       typeof report.metrics.inferenceRate === 'number' &&
                       typeof report.metrics.contradictionRate === 'number' &&
                       typeof report.metrics.resourceUtilization === 'number';
            }
        },
        {
            name: 'Get reasoning trace',
            action: (nar) => {
                // Actions are already performed in the previous step.
                // No new action needed.
            },
            assert: (nar) => {
                // The getTrace function should return an array of recent operations.
                const trace = nar.meta.getTrace(5);
                // We expect the trace to be an array and contain some items.
                return Array.isArray(trace) && trace.length > 0;
            }
        }
    ]
};
