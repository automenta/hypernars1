import React, { useState, useContext, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { TuiContext } from '../contexts/TuiContext.js';
import pkg from 'cli-boxes';
const { single, hidden } = pkg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const demoDir = path.join(__dirname, '../../demos');

const Tab = ({ label, isActive }) => (
    <Box marginRight={2} borderStyle={isActive ? single : hidden} paddingX={1}>
        <Text bold color={isActive ? 'cyan' : 'gray'}>{label}</Text>
    </Box>
);

const InteractionView = () => {
    const { handleCommand, runDemo, log } = useContext(TuiContext);
    const [activeTab, setActiveTab] = useState('input'); // input, demos

    // State from InputView
    const [inputValue, setInputValue] = useState('');
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // State from DemoView
    const [demos, setDemos] = useState([]);

    // Effect from DemoView
    useEffect(() => {
        const loadDemos = async () => {
            try {
                const files = await fs.readdir(demoDir).then(f => f.filter(x => x.endsWith('.js')).sort());
                const demoModules = await Promise.all(files.map(async file => {
                    const module = await import(path.join(demoDir, file));
                    return {
                        label: module.default.name,
                        value: module.default
                    };
                }));
                setDemos(demoModules);
            } catch (e) {
                if (log) log(`Error loading demos: ${e.message}`);
            }
        };
        loadDemos();
    }, [log]);

    useInput((input, key) => {
        if (input.toUpperCase() === 'I') {
            setActiveTab('input');
            return;
        }
        if (input.toUpperCase() === 'D') {
            setActiveTab('demos');
            return;
        }

        if (activeTab === 'input') {
            if (key.upArrow) {
                const newIndex = Math.min(history.length - 1, historyIndex + 1);
                setHistoryIndex(newIndex);
                setInputValue(history[newIndex] || '');
            }
            if (key.downArrow) {
                const newIndex = Math.max(-1, historyIndex - 1);
                setHistoryIndex(newIndex);
                setInputValue(history[newIndex] || '');
            }
        }
    });

    const handleSubmit = () => {
        if (handleCommand && inputValue) {
            handleCommand(inputValue);
            setHistory(prev => [inputValue, ...prev]);
            setHistoryIndex(-1);
            setInputValue('');
        }
    };

    const handleDemoSelect = (item) => {
        if (runDemo) {
            runDemo(item.value);
        }
    };

    const renderInput = () => (
        <Box paddingX={1}>
            <Box marginRight={1}><Text>&gt;</Text></Box>
            <TextInput
                value={inputValue}
                onChange={setInputValue}
                onSubmit={handleSubmit}
            />
        </Box>
    );

    const renderDemos = () => (
        <Box flexDirection="column" paddingX={1}>
            <SelectInput items={demos} onSelect={handleDemoSelect} />
        </Box>
    );

    return (
        <Box flexDirection="column" flexGrow={1}>
            <Box>
                <Tab label="[I]nput" isActive={activeTab === 'input'} />
                <Tab label="[D]emos" isActive={activeTab === 'demos'} />
            </Box>
            <Box flexGrow={1} borderStyle={single} borderColor="green">
                {activeTab === 'input' ? renderInput() : renderDemos()}
            </Box>
        </Box>
    );
};

export default InteractionView;
