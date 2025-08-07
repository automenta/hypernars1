import React, { useContext } from 'react';
import { Box, Text } from 'ink';
import { TuiContext } from '../contexts/TuiContext.js';

const StatusView = () => {
    const { nar, sps, isRunning } = useContext(TuiContext);

    if (!nar) {
        return null;
    }

    const concepts = nar.state.hypergraph.size;
    const queue = nar.state.eventQueue.heap.filter(Boolean).length;
    const step = nar.state.currentStep;
    const runState = isRunning ? '▶ RUNNING' : '❚❚ PAUSED';
    const runColor = isRunning ? 'green' : 'yellow';

    return (
        <Box width="100%">
            <Box>
                <Text color="cyan">Sys:</Text>
                <Text color="white"> {step.toLocaleString()}</Text>
                <Text color="gray"> | </Text>
                <Text color="cyan">Conc:</Text>
                <Text color="white"> {concepts.toLocaleString()}</Text>
                <Text color="gray"> | </Text>
                <Text color="cyan">Que:</Text>
                <Text color="white"> {queue.toLocaleString()}</Text>
                <Text color="gray"> | </Text>
                <Text color="cyan">SPS:</Text>
                <Text color="white"> {(sps || 0).toFixed(1)}</Text>
            </Box>
            <Box flexGrow={1} />
            <Box>
                <Text color={runColor} bold>
                    {runState}
                </Text>
            </Box>
        </Box>
    );
};

export default StatusView;
