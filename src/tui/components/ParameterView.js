import React, { useState, useContext } from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import { NarContext } from '../App.jsx';

const ParameterView = () => {
    const { nar, updateConfig } = useContext(NarContext);
    const [editingItem, setEditingItem] = useState(null);
    const [inputValue, setInputValue] = useState('');

    const items = nar ? Object.entries(nar.config).map(([key, value]) => ({
        label: `${key}: ${value}`,
        value: key
    })) : [];

    const handleSelect = (item) => {
        setEditingItem(item.value);
        setInputValue(String(nar.config[item.value]));
    };

    const handleSubmit = () => {
        if (editingItem) {
            updateConfig(editingItem, inputValue);
            setEditingItem(null);
            setInputValue('');
        }
    };

    if (editingItem) {
        return (
            <Box flexDirection="column" paddingX={1}>
                <Text bold>Edit {editingItem}</Text>
                <Box>
                    <Box marginRight={1}><Text>&gt;</Text></Box>
                    <TextInput
                        value={inputValue}
                        onChange={setInputValue}
                        onSubmit={handleSubmit}
                    />
                </Box>
            </Box>
        );
    }

    return (
        <Box flexDirection="column" paddingX={1}>
            <Text bold>Parameters</Text>
            <SelectInput items={items} onSelect={handleSelect} />
        </Box>
    );
};

export default ParameterView;
