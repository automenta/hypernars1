import React, { useState, useContext, useEffect, useMemo } from 'react';
import { Box, Text, useInput, useStdin } from 'ink';
import SelectInput from 'ink-select-input';
import { TuiContext } from '../contexts/TuiContext.js';

const PAGE_SIZE = 10;

const MemoryView = () => {
    const { nar, handleSelectConcept } = useContext(TuiContext);
    const { isRawModeSupported } = useStdin();
    const [allConcepts, setAllConcepts] = useState([]);
    const [sortBy, setSortBy] = useState('confidence'); // confidence, frequency, recency
    const [filterType, setFilterType] = useState(null);
    const [page, setPage] = useState(0);

    useEffect(() => {
        if (!nar) return;
        const interval = setInterval(() => {
            setAllConcepts([...nar.state.hypergraph.values()]);
        }, 500);
        return () => clearInterval(interval);
    }, [nar]);

    const sortedAndFilteredConcepts = useMemo(() => {
        let concepts = [...allConcepts];
        if (filterType) {
            concepts = concepts.filter(c => c.type === filterType);
        }
        const sorters = {
            confidence: (a, b) => (b.getTruth()?.confidence ?? 0) - (a.getTruth()?.confidence ?? 0),
            frequency: (a, b) => (b.getTruth()?.frequency ?? 0) - (a.getTruth()?.frequency ?? 0),
            recency: (a, b) => (b.beliefs[0]?.timestamp || 0) - (a.beliefs[0]?.timestamp || 0),
        };
        concepts.sort(sorters[sortBy]);
        return concepts;
    }, [allConcepts, sortBy, filterType]);

    const totalPages = Math.ceil(sortedAndFilteredConcepts.length / PAGE_SIZE);

    useInput((input) => {
        if (input === 'c') { setSortBy('confidence'); setPage(0); }
        else if (input === 'f') { setSortBy('frequency'); setPage(0); }
        else if (input === 'r') { setSortBy('recency'); setPage(0); }
        else if (input === 'j') { setFilterType(t => t === 'judgement' ? null : 'judgement'); setPage(0); }
        else if (input === 'q') { setFilterType(t => t === 'question' ? null : 'question'); setPage(0); }
        else if (input === 'a') { setFilterType(null); setPage(0); }
        else if (input === '>' || input === '.') setPage(p => Math.min(p + 1, totalPages - 1));
        else if (input === '<' || input === ',') setPage(p => Math.max(p - 1, 0));
    }, { isActive: isRawModeSupported });

    const paginatedConcepts = useMemo(() => {
        const start = page * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        return sortedAndFilteredConcepts.slice(start, end).map(h => {
            const truth = h.getTruth();
            const f = truth?.frequency?.toFixed(2) ?? 'N/A';
            const c = truth?.confidence?.toFixed(2) ?? 'N/A';
            return {
                label: `${h.id.substring(0, 20)}... ${h.type} (f:${f} c:${c})`,
                value: h.id,
            };
        });
    }, [sortedAndFilteredConcepts, page]);

    const handleSelect = (item) => {
        if (item) handleSelectConcept(item.value);
    };

    const getHeader = () => {
        let header = `Memory (Sort: ${sortBy}`;
        if (filterType) header += `, Filter: ${filterType}`;
        header += ` | Page: ${page + 1}/${totalPages})`;
        return header;
    };

    return (
        <Box flexDirection="column" paddingX={1} flexGrow={1}>
            <Box flexDirection="column">
                <Text bold>{getHeader()}</Text>
                <Text color="gray" dimColor>
                    Sort: [c], [f], [r] | Filter: [j], [q], [a] | Page: [&lt;] [&gt;]
                </Text>
            </Box>
            {isRawModeSupported ? (
                <SelectInput items={paginatedConcepts} onSelect={handleSelect} />
            ) : (
                <Text>[Input disabled in non-interactive mode]</Text>
            )}
        </Box>
    );
};

export default MemoryView;
