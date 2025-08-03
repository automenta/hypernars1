export default {
  name: '23. Knowledge Base Stress Test',
  description: 'Tests system performance and stability with a large knowledge base.',
  skipped: false,
  steps: [
    {
      comment: 'Step 1: Populate the knowledge base with a large number of beliefs and rules.',
      action: (nar) => {
        const numConcepts = 2000;
        const numRules = 500;

        nar.config.beliefCapacity = 20; // Increase capacity to handle the load

        for (let i = 0; i < numConcepts; i++) {
          nar.nal(`Term(concept_${i}).`);
        }

        for (let i = 0; i < numRules; i++) {
          const premise = `concept_${i}`;
          const conclusion = `property_${i % 100}`;
          nar.nal(`<${premise} --> ${conclusion}>.`);
        }

        // Add a specific, verifiable fact
        nar.nal('<concept_1999 --> target_property>. %1.0;0.99%');
      },
    },
    {
      comment: 'Step 2: Run the system for enough cycles to process the knowledge.',
      action: (nar) => {
        nar.run(200);
      },
    },
    {
        comment: 'Step 3: Perform a query and assert the result is found correctly.',
        action: (nar) => {
            // This action is just a placeholder to separate the final assertion.
        },
        assert: (nar, logs) => {
            const result = nar.query('<concept_1999 --> ?x>');
            if (!result || result.length === 0) {
                logs.push('[ASSERT FAILED] Query for target property returned no results.');
                return false;
            }

            const binding = result[0].bindings['?x'];
            if (binding !== 'target_property') {
                logs.push(`[ASSERT FAILED] Query returned wrong binding. Expected "target_property", got "${binding}".`);
                return false;
            }

            return true;
        }
    }
  ]
};
