import React, { useState, useEffect, useContext } from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { NarContext } from '../App.jsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const demoDir = path.join(__dirname, '../../demos');

const DemoView = () => {
    const { runDemo } = useContext(NarContext);
    const [demos, setDemos] = useState([]);

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
                // log(`Error loading demos: ${e.message}`);
            }
        };
        loadDemos();
    }, []);

    const handleSelect = (item) => {
        if (runDemo) {
            runDemo(item.value);
        }
    };

    return (
        <Box flexDirection="column" paddingX={1}>
            <Text bold>Demos</Text>
            <SelectInput items={demos} onSelect={handleSelect} />
        </Box>
    );
};

export default DemoView;
