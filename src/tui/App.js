import React, { useState, useCallback } from 'react';
import { useInput } from 'ink';

import ConceptView from './components/ConceptView.js';
import MainLayout from './components/MainLayout.js';
import { useNarSystem } from '../hooks/useNarSystem.js';
import { TuiContext } from './contexts/TuiContext.js';

const App = ({ nar }) => {
    const [logs, setLogs] = useState([]);
    const [selectedConceptId, setSelectedConceptId] = useState(null);
    const [activeTab, setActiveTab] = useState('memory'); // memory, queue, system

    const log = useCallback((message) => {
        setLogs(prev => [...prev, String(message)].slice(-100)); // Increased log history
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
        sps,
    } = useNarSystem(nar, log);

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
        if (selectedConceptId) return;

        if (input === 's') start();
        else if (input === 'p') pause();
        else if (input === 't') step();
        else if (input === 'c') clear();
        else if (input === '+') setRunDelay(d => Math.max(0, d / 2));
        else if (input === '-') setRunDelay(d => d * 2 || 10);
        else if (input === '1') setActiveTab('memory');
        else if (input === '2') setActiveTab('queue');
        else if (input === '3') setActiveTab('system');
        else if (key.escape) process.exit();
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
        nar, log, logs, handleCommand, start, pause, step, clear, isRunning,
        runDemo, updateConfig, handleSelectConcept, runDelay, setRunDelay,
        activeTab, setActiveTab, sps
    };

    if (selectedConceptId) {
        return (
            <TuiContext.Provider value={contextValue}>
                <ConceptView conceptId={selectedConceptId} onClose={handleCloseConceptView} />
            </TuiContext.Provider>
        );
    }

    return (
        <TuiContext.Provider value={contextValue}>
            <MainLayout />
        </TuiContext.Provider>
    );
};

export default App;
