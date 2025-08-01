import React, { useContext } from 'react';
import { Box, Text } from 'ink';
import { TuiContext } from '../contexts/TuiContext.js';
import pkg from 'cli-boxes';
const { round, single } = pkg;

import LogView from './LogView.js';
import MemoryView from './MemoryView.js';
import QueueView from './QueueView.js';
import SystemView from './SystemView.js';
import ContradictionView from './ContradictionView.js';
import TemporalView from './TemporalView.js';
import ControlView from './ControlView.js';
import ParameterView from './ParameterView.js';
import InteractionView from './InteractionView.js';
import StatusView from './StatusView.js';


const Tab = ({ label, isActive }) => (
    <Box
        marginRight={2}
        borderStyle={isActive ? round : undefined}
        borderColor={isActive ? 'cyan' : 'gray'}
        paddingX={1}
    >
        <Text bold color={isActive ? 'cyan' : 'white'}>{label}</Text>
    </Box>
);

const MainLayout = () => {
    const { activeTab } = useContext(TuiContext);

    const renderActiveTab = () => {
        switch (activeTab) {
            case 'queue': return <QueueView />;
            case 'system': return <SystemView />;
            case 'contradictions': return <ContradictionView />;
            case 'temporal': return <TemporalView />;
            case 'memory':
            default:
                return <MemoryView />;
        }
    };

    return (
        <Box flexDirection="column" width="100%" height="100%">
            {/* Main Content Area */}
            <Box flexGrow={1} flexDirection="row">
                {/* Left Panel */}
                <Box width="70%" flexDirection="column" padding={1}>
                    {/* Log View */}
                    <Box flexGrow={3} borderStyle={round} borderColor="blue" padding={1}>
                        <LogView />
                    </Box>
                    {/* Tabbed View */}
                    <Box flexGrow={2} marginTop={1} flexDirection="column">
                        <Box>
                            <Tab label="[1] Memory" isActive={activeTab === 'memory'} />
                            <Tab label="[2] Queue" isActive={activeTab === 'queue'} />
                            <Tab label="[3] System" isActive={activeTab === 'system'} />
                            <Tab label="[4] Contradictions" isActive={activeTab === 'contradictions'} />
                            <Tab label="[5] Temporal" isActive={activeTab === 'temporal'} />
                        </Box>
                        <Box borderStyle={round} borderColor="blue" flexGrow={1} padding={1}>
                            {renderActiveTab()}
                        </Box>
                    </Box>
                </Box>

                {/* Right Panel */}
                <Box width="30%" flexDirection="column" borderLeftStyle={single} borderLeftColor="gray" padding={1}>
                    <Box flexGrow={1} borderStyle={round} borderColor="magenta" padding={1}>
                        <ControlView />
                    </Box>
                    <Box flexGrow={1} marginTop={1} borderStyle={round} borderColor="magenta" padding={1}>
                        <ParameterView />
                    </Box>
                    <Box flexGrow={1} marginTop={1} borderStyle={round} borderColor="magenta" padding={1}>
                        <InteractionView />
                    </Box>
                </Box>
            </Box>

            {/* Status Bar */}
            <Box
                borderTopStyle={single}
                borderTopColor="gray"
                paddingX={1}
                height={1}
            >
                <StatusView />
            </Box>
        </Box>
    );
};

export default MainLayout;
