import React, { useContext } from 'react';
import { Box, Text } from 'ink';
import { NarContext } from '../App.jsx';

const ControlView = () => {
    const { start, pause, step, clear, isRunning, runDelay } = useContext(NarContext);

    return (
        <Box flexDirection="column" padding={1}>
            <Text bold>Controls</Text>
            <Box>
                <Box marginRight={2}><Text color={isRunning ? "gray" : "green"}>[S]tart</Text></Box>
                <Box marginRight={2}><Text color={isRunning ? "yellow" : "gray"}>[P]ause</Text></Box>
                <Box marginRight={2}><Text color="blue">[T]step</Text></Box>
                <Box><Text color="red">[C]lear</Text></Box>
            </Box>
            <Box marginTop={1}>
                <Text>Speed: {runDelay}ms/step</Text>
                <Box marginLeft={2}><Text color="magenta">[+] faster</Text></Box>
                <Box marginLeft={2}><Text color="magenta">[-] slower</Text></Box>
            </Box>
        </Box>
    );
};

export default ControlView;
