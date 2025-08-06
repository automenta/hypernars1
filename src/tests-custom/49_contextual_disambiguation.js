export default {
    name: '49. Contextual Disambiguation',
    description: 'Tests the ability to resolve the meaning of an ambiguous term using context.',
    steps: [
        {
            comment: 'Establish background knowledge about the two meanings of "bank".',
            action: (nar) => {
                // Meaning 1: A bank is a financial institution.
                nar.nal('<bank_financial ==> bank>. %1.0;0.9%');
                nar.nal('<bank_financial ==> has_property_deposits>. %1.0;0.9%');

                // Meaning 2: A bank is a river edge.
                nar.nal('<bank_river ==> bank>. %1.0;0.9%');
                nar.nal('<bank_river ==> has_property_fishing>. %1.0;0.9%');
                nar.run(10);
            }
        },
        {
            comment: 'Provide a sentence with the ambiguous term in a financial context.',
            action: (nar) => {
                // Context: "The event involved a bank and involved deposits."
                nar.nal('<event_deposits ==> involves_bank>. %1.0;0.9%');
                nar.nal('<event_deposits ==> involves_deposits>. %1.0;0.9%');

                // Link the context to the abstract property.
                nar.nal('<involves_bank ==> bank>. %1.0;0.9%');
                nar.nal('<involves_deposits ==> has_property_deposits>. %1.0;0.9%');

                nar.run(100);
            },
            assert: (nar, logs) => {
                // The system should infer that the "bank" in this event is the financial one.
                const belief = nar.getBelief('<event_deposits ==> bank_financial>');

                // And it should not associate it with the river bank.
                const mistakenBelief = nar.getBelief('<event_deposits ==> bank_river>');

                return belief && belief.truth.expectation() > 0.6 && (!mistakenBelief || mistakenBelief.truth.expectation() < 0.3);
            }
        },
        {
            comment: 'Provide a sentence with the ambiguous term in a nature context.',
            action: (nar) => {
                if (nar.logs) nar.logs.length = 0;

                // Context: "The event involved a bank and involved fishing."
                nar.nal('<event_fishing ==> involves_bank>. %1.0;0.9%');
                nar.nal('<event_fishing ==> involves_fishing>. %1.0;0.9%');
                nar.nal('<involves_fishing ==> has_property_fishing>. %1.0;0.9%');

                nar.run(100);
            },
            assert: (nar, logs) => {
                // The system should infer that this "bank" is the river bank.
                const belief = nar.getBelief('<event_fishing ==> bank_river>');

                // And it should not associate it with the financial bank.
                const mistakenBelief = nar.getBelief('<event_fishing ==> bank_financial>');

                return belief && belief.truth.expectation() > 0.6 && (!mistakenBelief || mistakenBelief.truth.expectation() < 0.3);
            }
        }
    ]
};
