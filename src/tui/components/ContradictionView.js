import React, { useContext, useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { TuiContext } from '../contexts/TuiContext.js';
import ContradictionDetailView from './ContradictionDetailView.js';

const ContradictionView = () => {
    const { nar } = useContext(TuiContext);
    const [contradictions, setContradictions] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [selectedContradictionId, setSelectedContradictionId] = useState(null);

    const updateContradictions = useCallback(() => {
        const contradictionMap = nar.contradictionManager?.contradictions;
        if (contradictionMap) {
            const contradictionList = Array.from(contradictionMap.entries()).map(([id, data]) => {
                const analysis = nar.contradictionManager.analyze(id);
                return {
                    id,
                    ...data,
                    analysis: analysis,
                };
            });
            setContradictions(contradictionList);
        }
    }, [nar]);

    useEffect(() => {
        updateContradictions();
        const interval = setInterval(updateContradictions, 1000);
        return () => clearInterval(interval);
    }, [updateContradictions]);

    useInput((input, key) => {
        if (selectedContradictionId) return;

        if (key.upArrow) {
            setSelectedIndex(prev => Math.max(0, prev - 1));
        } else if (key.downArrow) {
            setSelectedIndex(prev => Math.min(contradictions.length - 1, prev + 1));
        } else if (key.return) {
            if (contradictions[selectedIndex]) {
                setSelectedContradictionId(contradictions[selectedIndex].id);
            }
        }
    });

    const handleCloseDetailView = useCallback(() => {
        setSelectedContradictionId(null);
    }, []);

    if (selectedContradictionId) {
        return <ContradictionDetailView contradictionId={selectedContradictionId} onClose={handleCloseDetailView} />;
    }

    return (
        <Box flexDirection="column" padding={1}>
            <Text bold>Contradictions ({contradictions.length})</Text>
            <Text>(Use up/down arrows to navigate, Enter to select)</Text>
            {contradictions.length === 0 ? (
                <Text>No contradictions detected.</Text>
            ) : (
                contradictions.map((contra, index) => (
                    <Box key={contra.id} borderStyle={index === selectedIndex ? 'single' : 'hidden'} paddingX={1}>
                        <Text color={index === selectedIndex ? 'cyan' : 'white'}>
                            {`${contra.id} (${contra.pairs.length} conflicting pair(s))`}
                            {contra.resolved
                                ? <Text color="green"> - Resolved: {contra.resolutionStrategy}</Text>
                                : <Text color="yellow"> - Suggests: {contra.analysis?.resolutionSuggestion?.strategy || 'N/A'}</Text>
                            }
                        </Text>
                    </Box>
                ))
            )}
        </Box>
    );
};

export default ContradictionView;
