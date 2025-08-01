import React, { useContext } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { NarContext } from '../App.jsx';

const InputView = () => {
    const { handleCommand } = useContext(NarContext);
    const [value, setValue] = React.useState('');

    const handleSubmit = () => {
        if (handleCommand && value) {
            handleCommand(value);
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
