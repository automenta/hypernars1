import React, { useContext, useEffect, useState } from 'react';
import { Box, Text, useInput, useStdin } from 'ink';
import { TuiContext } from '../contexts/TuiContext.js';

const SystemView = () => {
    const { nar, sps } = useContext(TuiContext);
    const { isRawModeSupported } = useStdin();
    const [history, setHistory] = useState({
        concepts: [],
        queue: [],
        sps: [],
    });
    const [showConfig, setShowConfig] = useState(false);

    useInput(
        (input) => {
            if (input === 'c') setShowConfig((v) => !v);
        },
        { isActive: isRawModeSupported }
    );

    useEffect(() => {
        if (!nar) return;
        const interval = setInterval(() => {
            setHistory((prev) => ({
                concepts: [...prev.concepts, nar.state.hypergraph.size].slice(
                    -20
                ),
                queue: [...prev.queue, nar.state.eventQueue.heap.length].slice(
                    -20
                ),
                sps: [...prev.sps, sps].slice(-20),
            }));
        }, 1000);
        return () => clearInterval(interval);
    }, [nar, sps]);

    const renderGraph = (data, label) => {
        const max = Math.max(...data, 1);
        const chars = [' ', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
        const line = data
            .map((d) => chars[Math.round((d / max) * (chars.length - 1))])
            .join('');
        return (
            <Box>
                <Text>
                    {label.padEnd(12)}: {line} ({data[data.length - 1] || 0})
                </Text>
            </Box>
        );
    };

    return (
        <Box flexDirection="column" paddingX={1}>
            <Text bold>System Overview</Text>
            <Box flexDirection="column" marginTop={1}>
                {renderGraph(history.concepts, 'Concepts')}
                {renderGraph(history.queue, 'Queue Size')}
                {renderGraph(history.sps, 'SPS')}
            </Box>
            <Box flexDirection="column" marginTop={1}>
                <Text bold>Configuration [c]</Text>
                {showConfig &&
                    nar &&
                    Object.entries(nar.config).map(([key, value]) => (
                        <Text key={key}>
                            - {key}: {String(value)}
                        </Text>
                    ))}
            </Box>
        </Box>
    );
};

export default SystemView;
