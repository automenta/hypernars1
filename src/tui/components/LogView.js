import React, { useContext, useEffect, useRef } from 'react';
import { Box, Text } from 'ink';
import { TuiContext } from '../contexts/TuiContext.js';

const LogView = () => {
    const { nar, log, logs } = useContext(TuiContext);
    const boxRef = useRef(null);

    useEffect(() => {
        if (!nar) return;

        const beliefHandler = (data) =>
            log(
                `[Belief] ${data.hyperedgeId.substring(0, 20)} f:${data.truth.frequency.toFixed(2)} c:${data.truth.confidence.toFixed(2)}`
            );
        const contradictionHandler = (data) =>
            log(`[!] Contradiction for ${data.hyperedgeId.substring(0, 20)}`);
        // const focusHandler = (data) => log(`[*] Focus: ${data.newFocus.substring(0,20)}`);

        nar.on('belief-added', beliefHandler);
        nar.on('contradiction-resolved', contradictionHandler);
        // nar.on('focus-changed', focusHandler);

        return () => {
            nar.removeListener('belief-added', beliefHandler);
            nar.removeListener('contradiction-resolved', contradictionHandler);
            // nar.removeListener('focus-changed', focusHandler);
        };
    }, [nar, log]);

    return (
        <Box
            ref={boxRef}
            flexDirection="column"
            padding={1}
            flexGrow={1}
            justifyContent="flex-end"
        >
            <Box flexDirection="column">
                <Text bold>Logs</Text>
                {logs.map((msg, i) => (
                    <Text key={i}>{msg}</Text>
                ))}
            </Box>
        </Box>
    );
};

export default LogView;
