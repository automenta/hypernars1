import React, { useState, useContext, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import { TuiContext } from '../contexts/TuiContext.js';

const PAGE_SIZE = 10;

const MemoryView = () => {
    const { nar, handleSelectConcept } = useContext(TuiContext);
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
            confidence: (a, b) => b.getTruth().c - a.getTruth().c,
            frequency: (a, b) => b.getTruth().f - a.getTruth().f,
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
    });

    const paginatedConcepts = useMemo(() => {
        const start = page * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        return sortedAndFilteredConcepts.slice(start, end).map(h => ({
            label: `${h.id.substring(0, 20)}... ${h.type} (f:${h.getTruth().f.toFixed(2)} c:${h.getTruth().c.toFixed(2)})`,
            value: h.id,
        }));
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
            <SelectInput items={paginatedConcepts} onSelect={handleSelect} />
        </Box>
    );
};

export default MemoryView;
