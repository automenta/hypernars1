import React, { useState, useContext, useEffect } from 'react';
import { Box, Text } from 'ink';
import { NarContext } from '../App.jsx';

const MemoryView = () => {
    const { nar } = useContext(NarContext);
    const [concepts, setConcepts] = useState([]);

    useEffect(() => {
        if (!nar) return;
        const interval = setInterval(() => {
            const currentConcepts = [...nar.state.hypergraph.values()].map(h => ({
                id: h.id.substring(0, 20),
                type: h.type,
                truth: `f:${h.truth.f.toFixed(2)} c:${h.truth.c.toFixed(2)}`,
            }));
            setConcepts(currentConcepts.slice(0, 10)); // show top 10
        }, 1000);

        return () => clearInterval(interval);
    }, [nar]);

    return (
        <Box flexDirection="column" paddingX={1}>
            <Text bold>Memory</Text>
            {concepts.map(c => (
                <Text key={c.id}>{`${c.id}... ${c.type} (${c.truth})`}</Text>
            ))}
        </Box>
    );
};

export default MemoryView;
