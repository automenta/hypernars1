import React, { useContext, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { NarContext } from '../App.jsx';

const InputView = () => {
    const { handleCommand } = useContext(NarContext);
    const [value, setValue] = useState('');
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    useInput((input, key) => {
        if (key.upArrow) {
            const newIndex = Math.min(history.length - 1, historyIndex + 1);
            setHistoryIndex(newIndex);
            setValue(history[newIndex] || '');
        }
        if (key.downArrow) {
            const newIndex = Math.max(-1, historyIndex - 1);
            setHistoryIndex(newIndex);
            setValue(history[newIndex] || '');
        }
    });

    const handleSubmit = () => {
        if (handleCommand && value) {
            handleCommand(value);
            setHistory(prev => [value, ...prev]);
            setHistoryIndex(-1);
            setValue('');
        }
    };

    return (
        <Box>
            <Box marginRight={1}>
                <Text>&gt;</Text>
            </Box>
            <TextInput
                value={value}
                onChange={setValue}
                onSubmit={handleSubmit}
            />
        </Box>
    );
};

export default InputView;
