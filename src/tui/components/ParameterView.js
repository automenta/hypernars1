import React, { useContext } from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import { NarContext } from '../App.jsx';

const ParameterView = () => {
    const { nar } = useContext(NarContext);
    const items = nar ? Object.entries(nar.config).map(([key, value]) => ({
        label: `${key}: ${value}`,
        value: key
    })) : [];

    const handleSelect = (item) => {
        // TODO: Implement parameter editing
    };

    return (
        <Box flexDirection="column" paddingX={1}>
            <Text bold>Parameters</Text>
            <SelectInput items={items} onSelect={handleSelect} />
        </Box>
    );
};

export default ParameterView;
