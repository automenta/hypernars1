export default {
    name: '51. Advanced Temporal Reasoning',
    description: 'Tests the advanced temporal reasoning capabilities described in enhance.a.md.',
    steps: [
        {
            name: 'Define event with time interval',
            action: (nar) => {
                // Assuming the API from enhance.a.md is implemented
                // "during('meeting', '9:00-10:00', 'daily')"
                nar.temporal.during('meeting', '09:00', '10:00', {recurring: 'daily'});
                nar.run(10);
            },
            assert: (nar) => {
                // The assertion should check if a temporal representation of the meeting exists.
                // This is an aspirational test; the exact check depends on the implementation.
                const meetingConcept = nar.getConcept('meeting');
                const temporalData = meetingConcept?.temporal;
                return temporalData && temporalData.intervals.some(i =>
                    i.start === '09:00' && i.end === '10:00' && i.recurring === 'daily'
                );
            }
        },
        {
            name: 'Define relative temporal relationship',
            action: (nar) => {
                // "before('lunch', 'afternoon_meeting', { confidence: 0.9 })"
                // Using the 'relate' function from the proposal
                nar.temporal.relate('lunch', 'afternoon_meeting', 'before', {confidence: 0.9});
                nar.run(10);
            },
            assert: (nar) => {
                // Check if the "before" relationship is stored between lunch and afternoon_meeting.
                const lunchConcept = nar.getConcept('lunch');
                const relation = lunchConcept?.relations.find(r =>
                    r.type === 'before' && r.target === 'afternoon_meeting'
                );
                return relation && relation.confidence === 0.9;
            }
        },
        {
            name: 'Make a temporal prediction',
            action: (nar) => {
                // "predict('traffic_jam', 'during(commute)', 30)"
                // Assuming a commute event is already known
                nar.temporal.during('commute', '08:00', '09:00');
                nar.temporal.predict('traffic_jam', 'during(commute)', 30); // Predict 30 mins into the future
                nar.run(20);
            },
            assert: (nar) => {
                // Check if a future-tense belief about a traffic jam has been created.
                const trafficJamBeliefs = nar.getBeliefs(nar.term('traffic_jam'));
                const futureBelief = trafficJamBeliefs.find(b => b.tense === 'future');
                // The exact timestamp would be dependent on the "current time" of the test runner.
                // For now, just checking for its existence is sufficient.
                return !!futureBelief;
            }
        },
        {
            name: 'Query the temporal context',
            action: (nar) => {
                // Set a specific time for the system to test context awareness
                nar.setTime('2025-08-06T09:30:00.000Z'); // Assumes a setTime function
            },
            assert: (nar) => {
                // "getContext()"
                const context = nar.temporal.getContext();
                // Based on the 'during' call in the first step, the context should be 'meeting'
                return context && context.current_events && context.current_events.includes('meeting');
            }
        }
    ]
};
