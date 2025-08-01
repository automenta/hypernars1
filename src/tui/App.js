import React, { createContext, useState, useCallback } from 'react';
import { Box, useInput } from 'ink';

import LogView from './components/LogView.js';
import MemoryView from './components/MemoryView.js';
import ControlView from './components/ControlView.js';
import ParameterView from './components/ParameterView.js';
import DemoView from './components/DemoView.js';
import InputView from './components/InputView.js';
import StatusView from './components/StatusView.js';
import ConceptView from './components/ConceptView.js';
import { useNar } from '../hooks/useNar.js';

export const NarContext = createContext(null);

const App = ({ nar }) => {
    const [logs, setLogs] = useState([]);
    const [selectedConceptId, setSelectedConceptId] = useState(null);

    const log = useCallback((message) => {
        setLogs(prev => [...prev, String(message)].slice(-20));
    }, []);

    const {
        isRunning,
        runDelay,
        setRunDelay,
        start,
        pause,
        step,
        clear,
        updateConfig,
    } = useNar(nar, log);


    const runDemo = (demo) => {
        if (!demo) return;
        try {
            log(`\n--- Running Demo: ${demo.name} ---`);
            const result = demo.run(nar, (msg) => log(msg));
            if (result) log(result);
        } catch (e) {
            log(`Error in demo "${demo.name}": ${e.message}`);
        }
    };

    useInput((input, key) => {
        if (selectedConceptId) return; // Disable global hotkeys when modal is open

        if (input === 's') start();
        if (input === 'p') pause();
        if (input === 't') step();
        if (input === 'c') clear();
        if (input === '+') setRunDelay(d => Math.max(0, d / 2));
        if (input === '-') setRunDelay(d => d * 2 || 10);
        if (key.escape) process.exit();
    });

    const handleCommand = (command) => {
        if (command.startsWith('/')) {
            const [cmd, ...args] = command.substring(1).split(' ');
            switch (cmd) {
                case 'quit': process.exit(0); break;
                case 'run': nar.run(parseInt(args[0], 10) || 1); break;
                case 'ask': nar.ask(args.join(' ')).then(a => log(`Answer: ${JSON.stringify(a)}`)).catch(e => log(`Error: ${e.message}`)); break;
                default: log(`Unknown command: ${command}`);
            }
        } else {
            try {
                log(`Added belief: ${nar.nal(command)}`);
            } catch (e) {
                log(`Error: ${e.message}`);
            }
        }
    };

    const handleSelectConcept = useCallback((conceptId) => {
        setSelectedConceptId(conceptId);
    }, []);

    const handleCloseConceptView = useCallback(() => {
        setSelectedConceptId(null);
    }, []);

    const contextValue = {
        nar, log, handleCommand, start, pause, step, clear, isRunning,
        runDemo, updateConfig, handleSelectConcept, runDelay, setRunDelay
    };

    if (selectedConceptId) {
        return <ConceptView conceptId={selectedConceptId} onClose={handleCloseConceptView} />;
    }

    return (
        <NarContext.Provider value={contextValue}>
            <Box flexDirection="column" width="100%" height={30}>
                <Box height="90%">
                    <Box width="70%" flexDirection="column">
                        <Box height="60%" borderStyle="single" borderColor="cyan">
                            <LogView logs={logs} />
                        </Box>
                        <Box height="40%" borderStyle="single" borderColor="cyan">
                            <MemoryView />
                        </Box>
                    </Box>
                    <Box width="30%" flexDirection="column">
                        <Box height="34%" borderStyle="single" borderColor="green">
                            <ControlView />
                        </Box>
                        <Box height="33%" borderStyle="single" borderColor="green">
                            <ParameterView />
                        </Box>
                        <Box height="33%" borderStyle="single"borderColor="green">
                            <DemoView />
                        </Box>
                    </Box>
                </Box>
                <Box height="10%" flexDirection="column">
                    <StatusView />
                    <InputView />
                </Box>
            </Box>
        </NarContext.Provider>
    );
};

export default App;
