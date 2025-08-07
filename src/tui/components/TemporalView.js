import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { TuiContext } from '../contexts/TuiContext.js';

const TemporalView = () => {
    const { nar } = useContext(TuiContext);
    const [temporalData, setTemporalData] = useState({
        intervals: [],
        constraints: [],
    });

    const updateTemporalData = useCallback(() => {
        const intervals = Array.from(nar.temporalManager.intervals.values());
        const constraints = Array.from(
            nar.temporalManager.temporalConstraints.values()
        );
        setTemporalData({ intervals, constraints });
    }, [nar]);

    useEffect(() => {
        updateTemporalData();
        const interval = setInterval(updateTemporalData, 1000);
        return () => clearInterval(interval);
    }, [updateTemporalData]);

    return (
        <Box flexDirection="column" padding={1} flexGrow={1}>
            <Box flexDirection="column" marginBottom={1}>
                <Text bold>Intervals ({temporalData.intervals.length})</Text>
                <Box flexDirection="column" paddingLeft={1}>
                    {temporalData.intervals.slice(0, 5).map((interval) => (
                        <Text key={interval.id}>
                            - {interval.term || interval.id}: [{interval.start},{' '}
                            {interval.end}]
                        </Text>
                    ))}
                    {temporalData.intervals.length > 5 && <Text>...</Text>}
                </Box>
            </Box>

            <Box flexDirection="column">
                <Text bold>
                    Constraints ({temporalData.constraints.length})
                </Text>
                <Box flexDirection="column" paddingLeft={1}>
                    {temporalData.constraints.slice(0, 5).map((constraint) => (
                        <Text key={constraint.id}>
                            - {constraint.event1} {constraint.relation}{' '}
                            {constraint.event2}
                        </Text>
                    ))}
                    {temporalData.constraints.length > 5 && <Text>...</Text>}
                </Box>
            </Box>
        </Box>
    );
};

export default TemporalView;
