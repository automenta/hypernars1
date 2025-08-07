export default {
    name: '40. Analogical Reasoning',
    description: 'Tests the system\'s ability to transfer knowledge between structurally similar concepts.',
    steps: [
        {
            comment: 'Establish a relationship in a base domain (solar system) and an analogous one in a target domain (atom), then check for knowledge transfer.',
            action: (nar) => {
                // Base domain knowledge: A system with a central star, has a central body.
                // Using simplified NAL for clarity.
                nar.nal('((&&, {star}, {planet}) ==> has_central_body). %1.0;0.9%');

                // Instance of the base domain.
                nar.nal('<solar_system ==> (&&, {sun}, {earth})>. %1.0;0.9%');
                nar.nal('<sun ==> star>. %1.0;0.9%');
                nar.nal('<earth ==> planet>. %1.0;0.9%');

                // Target domain knowledge: An atom has a nucleus and electrons.
                nar.nal('<atom ==> (&&, {nucleus}, {electron})>. %1.0;0.9%');

                // The analogy: an atom is structurally similar to a solar system.
                // And a nucleus is to an atom what a sun is to a solar system.
                nar.nal('<atom <-> solar_system>. %0.9;0.9%');
                nar.nal('<nucleus <-> sun>. %0.9;0.9%');

                nar.run(150);
            },
            assert: (nar, logs) => {
                // After reasoning, the system should infer that an atom also has a central body
                // by applying the logic from the solar system domain to the atom domain via the analogy.
                const inferredBelief = nar.getBelief('<atom ==> has_central_body>');

                // The belief should be present and have a high expectation.
                return inferredBelief && inferredBelief.truth.expectation() > 0.5;
            }
        }
    ]
};
