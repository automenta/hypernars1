import React, {useContext, useEffect, useState} from 'react';
import {Box, Text} from 'ink';
import SelectInput from 'ink-select-input';
import {TuiContext} from '../contexts/TuiContext.js';

const QueueView = () => {
    const {nar} = useContext(TuiContext);
    const [events, setEvents] = useState([]);

    useEffect(() => {
        if (!nar) return;
        const interval = setInterval(() => {


            const queueItems = [...nar.state.eventQueue.heap]
                .filter(Boolean)
                .slice(0, 10)
                .map(item => ({
                    label: `Evt: ${item.hyperedgeId.substring(0, 20)}... (p:${item.budget.priority.toFixed(2)})`,
                    value: item.hyperedgeId,
                }));
            setEvents(queueItems);
        }, 500);

        return () => clearInterval(interval);
    }, [nar]);

    return (
        <Box flexDirection="column" paddingX={1} flexGrow={1}>
            <Text bold>Event Queue (Top 10 by Priority)</Text>
            <SelectInput items={events}/>
        </Box>
    );
};

export default QueueView;
