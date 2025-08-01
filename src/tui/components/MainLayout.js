import React, { useContext } from 'react';
import { Box, Text } from 'ink';
import { TuiContext } from '../contexts/TuiContext.js';

import LogView from './LogView.js';
import MemoryView from './MemoryView.js';
import QueueView from './QueueView.js';
import SystemView from './SystemView.js';
import ControlView from './ControlView.js';
import ParameterView from './ParameterView.js';
import InteractionView from './InteractionView.js';
import StatusView from './StatusView.js';

const Tab = ({ label, isActive }) => (
    <Box marginRight={2} borderStyle={isActive ? 'single' : 'hidden'} paddingX={1}>
        <Text bold color={isActive ? 'cyan' : 'gray'}>{label}</Text>
    </Box>
);

const MainLayout = () => {
    const { activeTab } = useContext(TuiContext);

    const renderActiveTab = () => {
        switch (activeTab) {
            case 'queue': return <QueueView />;
            case 'system': return <SystemView />;
            case 'memory':
            default:
                return <MemoryView />;
        }
    };

    return (
        <Box flexDirection="column" width="100%" height={30}>
            <Box height="95%">
                <Box width="70%" flexDirection="column">
                    <Box height="60%" borderStyle="single" borderColor="cyan">
                        <LogView />
                    </Box>
                    <Box height="40%" flexDirection="column">
                        <Box>
                            <Tab label="[1] Memory" isActive={activeTab === 'memory'} />
                            <Tab label="[2] Queue" isActive={activeTab === 'queue'} />
                            <Tab label="[3] System" isActive={activeTab === 'system'} />
                        </Box>
                        <Box borderStyle="single" borderColor="cyan" flexGrow={1}>
                            {renderActiveTab()}
                        </Box>
                    </Box>
                </Box>
                <Box width="30%" flexDirection="column">
                    <Box height="34%" borderStyle="single" borderColor="green">
                        <ControlView />
                    </Box>
                    <Box height="33%" borderStyle="single" borderColor="green">
                        <ParameterView />
                    </Box>
                    <Box height="33%" borderStyle="single" borderColor="green">
                        <InteractionView />
                    </Box>
                </Box>
            </Box>
            <Box height="5%">
                <StatusView />
            </Box>
        </Box>
    );
};

export default MainLayout;
