import React, { useContext, useEffect } from 'react';
import { Box, Text } from 'ink';
import { NarContext } from '../App.js';

const LogView = ({ logs }) => {
    const { nar, log } = useContext(NarContext);

    useEffect(() => {
        if (!nar) return;

        const beliefHandler = (data) => log(`[Belief] ${data.hyperedgeId.substring(0,20)} f:${data.truth.frequency.toFixed(2)} c:${data.truth.confidence.toFixed(2)}`);
        const contradictionHandler = (data) => log(`[!] Contradiction for ${data.hyperedgeId.substring(0,20)}`);
        const focusHandler = (data) => log(`[*] Focus: ${data.newFocus.substring(0,20)}`);

        nar.on('belief-added', beliefHandler);
        nar.on('contradiction-resolved', contradictionHandler);
        nar.on('focus-changed', focusHandler);

        return () => {
            nar.removeListener('belief-added', beliefHandler);
            nar.removeListener('contradiction-resolved', contradictionHandler);
            nar.removeListener('focus-changed', focusHandler);
        };
    }, [nar, log]);

    return (
        <Box flexDirection="column" padding={1}>
            <Text bold>Logs</Text>
            {logs.map((msg, i) => (
                <Text key={i}>{msg}</Text>
            ))}
        </Box>
    );
};

export default LogView;
