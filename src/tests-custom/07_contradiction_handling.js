export default {
    name: '7. Contradiction Handling',
    description: 'Tests how the system handles various contradiction scenarios.',
    skipped: false, // SKIPPED: Uncovered potential bug where a strong contradiction is detected but not resolved as expected.
    steps: [
        {
            comment: 'Case 1: Strong, direct contradiction should be detected and resolved.',
            action: (nar) => {
                const {TruthValue} = nar.api;
                nar.inheritance('sky', 'blue', {truth: new TruthValue(0.9, 0.9)});
                nar.inheritance('sky', 'blue', {truth: new TruthValue(0.1, 0.9)});
                nar.run(200);
            },
            assert: (nar, logs) => {
                const detected = logs.some(l => l.includes('Contradiction detected for Inheritance(sky,blue)'));
                const resolved = logs.some(l => l.includes('Contradiction resolved for Inheritance(sky,blue)'));
                return detected && resolved;
            }
        },
        {
            comment: 'Case 2: Weak, below-threshold contradiction should be ignored.',
            action: (nar) => {
                const {TruthValue} = nar.api;
                nar.inheritance('moon', 'cheese', {truth: new TruthValue(0.9, 0.2)});
                nar.inheritance('moon', 'cheese', {truth: new TruthValue(0.1, 0.2)});
                nar.run(200);
            },
            assert: (nar, logs) => {
                const detected = logs.some(l => l.includes('Contradiction detected for Inheritance(moon,cheese)'));
                return !detected;
            }
        },
        {
            comment: 'Case 3: Boundary contradiction should be ignored.',
            action: (nar) => {
                const {TruthValue} = nar.api;
                nar.inheritance('sun', 'conscious', {truth: new TruthValue(0.8, 0.65)});
                nar.inheritance('sun', 'conscious', {truth: new TruthValue(0.2, 0.65)});
                nar.run(200);
            },
            assert: (nar, logs) => {
                const detected = logs.some(l => l.includes('Contradiction detected for Inheritance(sun,conscious)'));
                return !detected;
            }
        }
    ]
};
