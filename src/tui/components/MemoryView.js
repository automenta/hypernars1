import React, { useState, useContext, useEffect } from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import { NarContext } from '../App.jsx';

const MemoryView = () => {
    const { nar, handleSelectConcept } = useContext(NarContext);
    const [concepts, setConcepts] = useState([]);

    useEffect(() => {
        if (!nar) return;
        const interval = setInterval(() => {
            const currentConcepts = [...nar.state.hypergraph.values()]
                .sort((a, b) => b.truth.c - a.truth.c) // sort by confidence
                .slice(0, 10) // show top 10
                .map(h => ({
                    label: `${h.id.substring(0, 20)}... ${h.type} (f:${h.truth.f.toFixed(2)} c:${h.truth.c.toFixed(2)})`,
                    value: h.id,
                }));
            setConcepts(currentConcepts);
        }, 1000);

        return () => clearInterval(interval);
    }, [nar]);

    const handleSelect = (item) => {
        if (item) {
            handleSelectConcept(item.value);
        }
    };

    return (
        <Box flexDirection="column" paddingX={1}>
            <Text bold>Memory (Top 10 by Confidence)</Text>
            <SelectInput items={concepts} onSelect={handleSelect} />
        </Box>
    );
};

export default MemoryView;
