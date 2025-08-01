import React, { useContext, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { TuiContext } from '../contexts/TuiContext.js';

const ConceptView = ({ conceptId, onClose }) => {
    const { nar, handleSelectConcept } = useContext(TuiContext);
    const [showBeliefs, setShowBeliefs] = useState(false);
    const [showRelated, setShowRelated] = useState(false);
    const concept = nar.state.hypergraph.get(conceptId);

    useInput((input, key) => {
        if (key.escape) onClose();
        else if (input === 'b') setShowBeliefs(v => !v);
        else if (input === 'r') setShowRelated(v => !v);
    });

    if (!concept) {
        return <Text>Concept {conceptId} not found. Press ESC to close.</Text>;
    }

    const renderBeliefs = () => (
        <Box flexDirection="column" marginTop={1}>
            <Text bold>Beliefs ({concept.beliefs.length}) [b]</Text>
            {showBeliefs && concept.beliefs.slice(0, 5).map(belief => (
                <Box key={belief.id} flexDirection="column" marginLeft={2}>
                    <Text>
                        f:{belief.truth.f.toFixed(2)} c:{belief.truth.c.toFixed(2)} | B: p:{belief.budget.p.toFixed(2)} d:{belief.budget.d.toFixed(2)} q:{belief.budget.q.toFixed(2)}
                    </Text>
                    <Text color="gray">
                        Premises: {belief.premises.length > 0 ? belief.premises.map(p => p.substring(0, 10)).join(', ') : 'None'}
                    </Text>
                </Box>
            ))}
        </Box>
    );

    const renderRelated = () => (
        <Box flexDirection="column" marginTop={1}>
            <Text bold>Related Concepts ({concept.args.length}) [r]</Text>
            {showRelated && concept.args.map(argId => (
                <Box key={argId} marginLeft={2}>
                    <Text color="cyan" onClick={() => handleSelectConcept(argId)}>
                        {argId}
                    </Text>
                </Box>
            ))}
        </Box>
    );

    return (
        <Box flexDirection="column" padding={1} borderStyle="single" borderColor="magenta">
            <Text bold>Concept Details</Text>
            <Text>ID: {concept.id}</Text>
            <Text>Type: {concept.type}</Text>
            <Text>Truth: f={concept.getTruth().f.toFixed(4)} c={concept.getTruth().c.toFixed(4)}</Text>

            {concept.beliefs?.length > 0 && renderBeliefs()}
            {concept.args?.length > 0 && renderRelated()}

            <Text marginTop={1}>---</Text>
            <Text>Press ESC to close. [b] to toggle beliefs. [r] to toggle related.</Text>
        </Box>
    );
};

export default ConceptView;
