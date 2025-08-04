import React, {useContext, useState} from 'react';
import {Box, Text, useStdin} from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import {TuiContext} from '../contexts/TuiContext.js';

const ParameterView = () => {
    const {nar, updateConfig} = useContext(TuiContext);
    const {isRawModeSupported} = useStdin();
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
                    {isRawModeSupported ? (
                        <TextInput
                            value={inputValue}
                            onChange={setInputValue}
                            onSubmit={handleSubmit}
                        />
                    ) : (
                        <Text>[Input disabled in non-interactive mode]</Text>
                    )}
                </Box>
            </Box>
        );
    }

    return (
        <Box flexDirection="column" paddingX={1}>
            <Text bold>Parameters</Text>
            {isRawModeSupported ? (
                <SelectInput items={items} onSelect={handleSelect}/>
            ) : (
                <Text>[Input disabled in non-interactive mode]</Text>
            )}
        </Box>
    );
};

export default ParameterView;
