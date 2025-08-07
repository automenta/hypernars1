import React, { useContext, useEffect, useState } from 'react';
import { Box, Text, useInput, useStdin } from 'ink';
import { TuiContext } from '../contexts/TuiContext.js';
import pkg from 'cli-boxes';

const { single, hidden, rounded } = pkg;

const Belief = ({ belief, isStrongest }) => (
    <Box
        flexDirection="column"
        marginBottom={1}
        borderStyle={rounded}
        padding={1}
        borderColor={isStrongest ? 'green' : 'yellow'}
    >
        <Text bold>
            Belief (Evidence Strength: {belief.evidenceStrength.toFixed(3)})
        </Text>
        <Text>
            {' '}
            Truth: f={belief.truth.frequency.toFixed(2)}, c=
            {belief.truth.confidence.toFixed(2)} (exp:{' '}
            {belief.truth.expectation().toFixed(2)})
        </Text>
        <Text>
            {' '}
            Budget: p={belief.budget.priority.toFixed(2)}, d=
            {belief.budget.durability.toFixed(2)}, q=
            {belief.budget.quality.toFixed(2)}
        </Text>
        {belief.evidence.length > 0 && (
            <Box flexDirection="column" marginLeft={2}>
                <Text bold>Evidence:</Text>
                {belief.evidence.map((e, i) => (
                    <Text key={i}>
                        - {e.source || 'unknown'} (strength:{' '}
                        {e.strength.toFixed(2)})
                    </Text>
                ))}
            </Box>
        )}
    </Box>
);

const ContradictionDetailView = ({ contradictionId, onClose }) => {
    const { nar, log } = useContext(TuiContext);
    const { isRawModeSupported } = useStdin();
    const [analysis, setAnalysis] = useState(null);
    const [strategies, setStrategies] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
        const analyzeContradiction = () => {
            const result = nar.contradictionManager?.analyze(contradictionId);
            setAnalysis(result);
            if (nar.contradictionManager?.resolutionStrategies) {
                setStrategies(
                    Object.keys(nar.contradictionManager.resolutionStrategies)
                );
            }
        };
        analyzeContradiction();
    }, [nar, contradictionId]);

    useInput(
        (input, key) => {
            if (key.escape) {
                onClose();
            } else if (key.upArrow) {
                setSelectedIndex((prev) => Math.max(0, prev - 1));
            } else if (key.downArrow) {
                setSelectedIndex((prev) =>
                    Math.min(strategies.length - 1, prev + 1)
                );
            } else if (key.return) {
                const selectedStrategy = strategies[selectedIndex];
                if (selectedStrategy) {
                    const result = nar.contradictionManager.manualResolve(
                        contradictionId,
                        selectedStrategy
                    );
                    if (result) {
                        log(
                            `Contradiction ${contradictionId} resolved with strategy: ${selectedStrategy}`
                        );
                    } else {
                        log(
                            `Failed to resolve contradiction ${contradictionId} with strategy: ${selectedStrategy}`
                        );
                    }
                    onClose();
                }
            }
        },
        { isActive: isRawModeSupported }
    );

    return (
        <Box
            flexDirection="column"
            padding={1}
            borderStyle={single}
            borderColor="red"
        >
            <Box>
                <Text bold>Contradiction Analysis: </Text>
                <Text>{contradictionId}</Text>
            </Box>
            <Text>
                (Press 'esc' to close, up/down to select strategy, Enter to
                resolve)
            </Text>
            <Box marginTop={1} flexDirection="column">
                {analysis ? (
                    <>
                        <Text bold>Conflicting Beliefs:</Text>
                        {analysis.contradictions.map((belief, index) => (
                            <Belief
                                key={belief.belief.id || index}
                                belief={belief}
                                isStrongest={index === 0}
                            />
                        ))}
                        <Box marginTop={1} flexDirection="column">
                            <Text bold>Resolution Suggestion:</Text>
                            <Text>
                                {' '}
                                System Suggests:{' '}
                                <Text color="cyan">
                                    {analysis.resolutionSuggestion.strategy}
                                </Text>
                            </Text>
                            <Text>
                                {' '}
                                Reason: {analysis.resolutionSuggestion.details}
                            </Text>
                        </Box>
                        <Box marginTop={1} flexDirection="column">
                            <Text bold>Manual Resolution:</Text>
                            {strategies.map((strategy, index) => (
                                <Box
                                    key={strategy}
                                    borderStyle={
                                        index === selectedIndex
                                            ? single
                                            : hidden
                                    }
                                    paddingX={1}
                                >
                                    <Text
                                        color={
                                            index === selectedIndex
                                                ? 'cyan'
                                                : 'white'
                                        }
                                    >{`${index + 1}. ${strategy}`}</Text>
                                </Box>
                            ))}
                        </Box>
                    </>
                ) : (
                    <Text>Loading analysis...</Text>
                )}
            </Box>
        </Box>
    );
};

export default ContradictionDetailView;
