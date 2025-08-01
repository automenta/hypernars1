import React, { useContext } from 'react';
import { Box, Text, useInput } from 'ink';
import { NarContext } from '../App.js';

const ConceptView = ({ conceptId, onClose }) => {
    const { nar } = useContext(NarContext);
    const concept = nar.state.hypergraph.get(conceptId);

    useInput((input, key) => {
        if (key.escape) {
            onClose();
        }
    });

    if (!concept) {
        return <Text>Concept {conceptId} not found. Press ESC to close.</Text>;
    }

    return (
        <Box flexDirection="column" padding={1} borderStyle="single" borderColor="magenta">
            <Text bold>Concept Details</Text>
            <Text>ID: {concept.id}</Text>
            <Text>Type: {concept.type}</Text>
            <Text>Truth: f={concept.truth.f.toFixed(4)} c={concept.truth.c.toFixed(4)}</Text>
            {/* TODO: Add more details, e.g., belief history */}
            <Text>---</Text>
            <Text>Press ESC to close.</Text>
        </Box>
    );
};

export default ConceptView;
