export default {
    name: '39. Causal Inference',
    description: 'Tests the system\'s ability to distinguish true causal factors from mere correlations.',
    steps: [
        {
            comment: 'Provide evidence that A and B are individually correlated with C, but are only jointly sufficient to cause C.',
            action: (nar) => {
                // Scenario: Flipping a switch (A) only turns on a light (C) if there is power (B).
                // Provide many examples to establish the causal link.
                for (let i = 0; i < 10; i++) {
                    // When switch is flipped and power is on, light is on.
                    nar.nal('<(<{switch_on} & <#power_on>>) =/> <#light_on>>. %1.0;0.9%');
                    // When switch is flipped but power is off, light is off.
                    nar.nal('<(<{switch_on} & <#power_off>>) =/> <#light_off>>. %1.0;0.9%');
                    // When switch is not flipped but power is on, light is off.
                    nar.nal('<(<{switch_off} & <#power_on>>) =/> <#light_off>>. %1.0;0.9%');
                }
                nar.run(200);
            },
            assert: (nar, logs) => {
                // The system should have a strong belief that both conditions are necessary.
                const causalLinkBelief = nar.getBelief('<(<{switch_on} & <#power_on>>) =/> <#light_on>>');

                // It should have a much weaker belief that flipping the switch alone causes the light to turn on.
                const switchCorrelationBelief = nar.getBelief('<{switch_on} =/> <#light_on>>');

                // It should also have a weak belief that power being on alone causes the light to turn on.
                const powerCorrelationBelief = nar.getBelief('<#power_on> =/> <#light_on>>');

                // The causal link must be believed strongly.
                if (!causalLinkBelief || causalLinkBelief.truth.confidence < 0.8) {
                    return false;
                }

                // The simple correlations should be significantly weaker than the true causal link.
                const switchConfidence = switchCorrelationBelief ? switchCorrelationBelief.truth.confidence : 0;
                const powerConfidence = powerCorrelationBelief ? powerCorrelationBelief.truth.confidence : 0;

                return switchConfidence < causalLinkBelief.truth.confidence &&
                       powerConfidence < causalLinkBelief.truth.confidence;
            }
        }
    ]
};
