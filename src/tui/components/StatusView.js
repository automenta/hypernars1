import React, { useState, useContext, useEffect } from 'react';
import { Box, Text } from 'ink';
import { NarContext } from '../App.jsx';

const StatusView = () => {
    const { nar } = useContext(NarContext);
    const [status, setStatus] = useState('');

    useEffect(() => {
        if (!nar) return;

        const interval = setInterval(() => {
            const concepts = nar.state.hypergraph.size;
            const queue = nar.state.eventQueue.heap.length;
            const step = nar.state.currentStep;
            setStatus(`Concepts: ${concepts} | Queue: ${queue} | Step: ${step}`);
        }, 1000);

        return () => clearInterval(interval);
    }, [nar]);

    return (
        <Box>
            <Text>{status}</Text>
        </Box>
    );
};

export default StatusView;
