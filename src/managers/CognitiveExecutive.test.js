import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import {CognitiveExecutive} from './CognitiveExecutive.js';

// Mock NAR system and its components
const mockNar = {
    state: {
        hypergraph: new Map(),
        eventQueue: {heap: []},
        questionPromises: new Map(),
        activations: new Map(),
        currentStep: 0,
    },
    config: {
        inferenceThreshold: 0.2,
        budgetThreshold: 0.1,
        maxPathLength: 10,
        questionTimeout: 5000,
        knowledgeTTL: 10000,
        cognitiveExecutive: {}, // for custom configs
        ruleConfig: {},
    },
    derivationEngine: {
        getAndResetInferenceCount: jest.fn().mockReturnValue(100),
        rules: new Map(),
    },
    questionHandler: {
        getAndResetQuestionResponseTimes: jest.fn().mockReturnValue([1000]),
    },
    api: {
        removeHyperedge: jest.fn(),
    },
    conceptFormation: {
        discoverNewConcepts: jest.fn(),
    },
    on: jest.fn(),
    emit: jest.fn(),
};

// Helper to create a mock hyperedge
const createMockHyperedge = (id, truthExpectation, lastAccess) => {
    const edge = {
        id,
        getTruthExpectation: () => truthExpectation,
    };
    mockNar.state.hypergraph.set(id, edge);
    mockNar.state.activations.set(id, lastAccess);
    return edge;
};


describe('CognitiveExecutive', () => {
    let executive;

    beforeEach(() => {
        // Reset mocks and state
        jest.clearAllMocks();
        mockNar.state.hypergraph.clear();
        mockNar.state.eventQueue.heap = [];
        mockNar.state.questionPromises.clear();
        mockNar.state.activations.clear();
        mockNar.config.inferenceThreshold = 0.2;
        mockNar.config.budgetThreshold = 0.1;
        mockNar.config.maxPathLength = 10;
        mockNar.derivationEngine.rules.clear();

        executive = new CognitiveExecutive(mockNar);
        executive.lastMetricTimestamp = Date.now() - 1000; // Set to 1s ago
    });

    describe('Initialization', () => {
        it('should initialize with default configuration', () => {
            expect(executive.config.MAINTENANCE_INTERVAL).toBe(100);
            expect(executive.resourceAllocation.derivation).toBe(0.6);
        });

        it('should allow overriding default configuration', () => {
            const customConfig = {MAINTENANCE_INTERVAL: 200};
            const customNar = {...mockNar, config: {...mockNar.config, cognitiveExecutive: customConfig}};
            const customExecutive = new CognitiveExecutive(customNar, customConfig);
            expect(customExecutive.config.MAINTENANCE_INTERVAL).toBe(200);
        });
    });

    describe('Self-Monitoring and Adaptation', () => {
        it('should calculate system metrics correctly', () => {
            mockNar.derivationEngine.getAndResetInferenceCount.mockReturnValue(50);
            executive.contradictionCount = 2;
            mockNar.state.eventQueue.heap = new Array(500);

            const metrics = executive._calculateMetrics();

            expect(metrics.inferenceRate).toBeCloseTo(50 / 200); // 50 inferences / normalization
            expect(metrics.contradictionRate).toBeCloseTo(2 / 5); // 2 contradictions / normalization
            expect(metrics.resourceUtilization).toBeCloseTo(500 / 2000); // 500 queue size / normalization
            expect(metrics.questionResponseTime).toBeCloseTo(1 - (1000 / 5000)); // 1 - (1s / 5s timeout)
        });

        it('should detect high-contradictions issue', () => {
            const metrics = {contradictionRate: 0.5};
            const issues = executive._detectIssues(metrics);
            expect(issues).toContain('high-contradictions');
        });

        it('should detect low-inference-rate issue', () => {
            const metrics = {inferenceRate: 0.05, queueSize: 200};
            const issues = executive._detectIssues(metrics);
            expect(issues).toContain('low-inference-rate');
        });

        it('should adapt reasoning parameters for high contradictions', () => {
            const initialThreshold = mockNar.config.inferenceThreshold;
            executive._adaptReasoningParameters(['high-contradictions'], {});
            expect(mockNar.config.inferenceThreshold).toBeGreaterThan(initialThreshold);
        });

        it('should adapt reasoning parameters for low inference rate', () => {
            const initialThreshold = mockNar.config.inferenceThreshold;
            executive._adaptReasoningParameters(['low-inference-rate'], {});
            expect(mockNar.config.inferenceThreshold).toBeLessThan(initialThreshold);
        });
    });

    describe('Resource and Focus Management', () => {
        it('should adjust resource allocation based on metrics', () => {
            const initialAllocation = executive.resourceAllocation.derivation;
            const metrics = {inferenceRate: 0.1, contradictionRate: 0.1}; // Low inference
            executive._adjustResourceAllocation(metrics);
            expect(executive.resourceAllocation.derivation).toBeGreaterThan(initialAllocation);
        });

        it('should normalize resource allocation to sum to 1', () => {
            const metrics = {inferenceRate: 0.1, contradictionRate: 0.6}; // low inference, high contradiction
            executive._adjustResourceAllocation(metrics);
            const total = Object.values(executive.resourceAllocation).reduce((a, b) => a + b, 0);
            expect(total).toBeCloseTo(1.0);
        });

        it('should adjust focus to question-answering', () => {
            mockNar.state.questionPromises.set('q1', {});
            executive._adjustReasoningFocus({});
            expect(executive.currentFocus).toBe('question-answering');
        });

        it('should adjust focus to contradiction-resolution', () => {
            const metrics = {contradictionRate: 0.5};
            executive._adjustReasoningFocus(metrics);
            expect(executive.currentFocus).toBe('contradiction-resolution');
        });
    });

    describe('Rule and Strategy Management', () => {
        it('should monitor derivation performance', () => {
            executive.monitorDerivation('TestRule', true, 10, 0.9);
            executive.monitorDerivation('TestRule', false, 15, 0.1);

            const stats = executive.rulePerformance.get('TestRule');
            expect(stats.successes).toBe(1);
            expect(stats.attempts).toBe(2);
            expect(stats.totalCost).toBe(25);
            expect(stats.totalValue).toBe(1.0);
        });

        it('should adapt rule priorities based on efficiency', () => {
            mockNar.derivationEngine.rules.set('EfficientRule', {priority: 0.5});
            mockNar.derivationEngine.rules.set('InefficientRule', {priority: 0.5});
            executive.rulePerformance.set('EfficientRule', {successes: 9, attempts: 10, totalCost: 100, totalValue: 9});
            executive.rulePerformance.set('InefficientRule', {
                successes: 1,
                attempts: 10,
                totalCost: 100,
                totalValue: 1
            });

            executive.adaptRulePriorities();

            const efficientRule = mockNar.derivationEngine.rules.get('EfficientRule');
            const inefficientRule = mockNar.derivationEngine.rules.get('InefficientRule');
            expect(efficientRule.priority).toBeGreaterThan(0.5);
            expect(inefficientRule.priority).toBeLessThan(0.5);
        });

        it('should return the active strategy based on context', () => {
            executive.configureStrategy({context: 'high-uncertainty', strategy: 'cautious', priority: 10});
            executive.configureStrategy({context: 'default', strategy: 'balanced', priority: 0});

            jest.spyOn(executive, '_assessReasoningContext').mockReturnValue(['high-uncertainty']);
            expect(executive.getActiveStrategy()).toBe('cautious');
        });
    });

    describe('Knowledge Pruning', () => {
        it('should prune low-value knowledge', () => {
            const now = Date.now();
            createMockHyperedge('oldAndWeak', 0.1, now - 20000); // Should be pruned
            createMockHyperedge('recentButWeak', 0.1, now - 1000); // Should not be pruned
            createMockHyperedge('oldButStrong', 0.8, now - 20000); // Should not be pruned

            executive._pruneLowValueKnowledge();

            expect(mockNar.api.removeHyperedge).toHaveBeenCalledWith('oldAndWeak');
            expect(mockNar.api.removeHyperedge).not.toHaveBeenCalledWith('recentButWeak');
            expect(mockNar.api.removeHyperedge).not.toHaveBeenCalledWith('oldButStrong');
        });
    });
});