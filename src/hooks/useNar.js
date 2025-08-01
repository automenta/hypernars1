import { useState, useCallback, useRef } from 'react';

export const useNar = (nar, log) => {
    const [isRunning, setIsRunning] = useState(false);
    const [runDelay, setRunDelay] = useState(100); // ms
    const runInterval = useRef(null);

    const pause = useCallback(() => {
        setIsRunning(false);
        if(runInterval.current) {
            clearTimeout(runInterval.current);
            runInterval.current = null;
        }
        log('== Reasoner Paused ==');
    }, [log]);

    const start = useCallback(() => {
        setIsRunning(true);
        log(`== Reasoner Started (delay: ${runDelay}ms) ==`);
        const stepFn = () => {
            nar.step();
            runInterval.current = setTimeout(() => {
                if (runInterval.current) stepFn();
            }, runDelay);
        };
        stepFn();
    }, [nar, log, runDelay]);

    const step = useCallback(() => {
        if(isRunning) pause();
        nar.step();
        log('-- Stepped --');
    }, [nar, log, isRunning, pause]);

    const clear = useCallback(() => {
        if (isRunning) pause();
        log('== Clearing Reasoner State ==');
        nar.clearState();
    }, [nar, log, isRunning, pause]);

    const updateConfig = useCallback((key, value) => {
        const numericValue = parseFloat(value);
        if (isNaN(numericValue)) {
            log(`Invalid value for ${key}: ${value}`);
            return;
        }
        nar.config[key] = numericValue;
        log(`Updated ${key} to ${numericValue}`);
    }, [nar, log]);

    return {
        isRunning,
        runDelay,
        setRunDelay,
        start,
        pause,
        step,
        clear,
        updateConfig,
    };
};
