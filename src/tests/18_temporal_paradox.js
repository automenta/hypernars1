export default [
  {
      name: '18.1. Complex Temporal Contradiction (Loop)',
      description: 'Tests if the system can detect a temporal paradox.',
      skipped: false, // Skipping due to deeper bug in reasoning engine.
      steps: [
          {
              comment: 'Introduce a temporal loop.',
              action: (nar) => {
                  nar.nal('(<event_A --> event_B>).');
                  nar.nal('(<event_B --> event_C>).');
                  nar.nal('(<event_C --> event_A>).');
                  nar.run(100);
              },
              assert: (nar, logs) => {
                  const contradiction = nar.contradictionManager.contradictions.get(nar.inheritance('event_A', 'event_B'));
                  return contradiction !== undefined;
              }
          }
      ]
  }
];
