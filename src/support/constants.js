/**
 * This file contains centralized constants for the NAR system
 * to avoid magic strings and numbers in the codebase.
 */

export const EVENT_TYPES = {
    BELIEF_PRUNED: 'belief-pruned',
    MAINTENANCE_INFO: 'maintenance-info',
    KNOWLEDGE_PRUNED: 'knowledge-pruned',
    PRUNING: 'pruning',
    REVISION: 'revision',
};

export const TASK_TYPES = {
    QUESTION: 'question',
    CRITICAL_EVENT: 'critical-event',
    DERIVATION: 'derivation',
    REVISION: 'revision',
    DEFAULT: 'default',
    GOAL: 'goal',
};

export const PRUNING_TYPES = {
    LOW_VALUE_PATHS: 'low-value-paths',
};

export const REGEX = {
    QUESTION_PATTERN: /^Question\((.*)\)$/,
};

export const LOG_LEVELS = {
    DEBUG: 'debug',
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error',
};

export const HYPEREDGE_TYPES = {
    INHERITANCE: 'Inheritance',
    SIMILARITY: 'Similarity',
    IMPLICATION: 'Implication',
    EQUIVALENCE: 'Equivalence',
    CONJUNCTION: 'Conjunction',
    TEMPORAL_RELATION: 'TemporalRelation',
    INSTANCE: 'Instance',
    PROPERTY: 'Property',
    TERM: 'Term',
};

export const RULE_NAMES = {
    INHERITANCE: 'Inheritance',
    SIMILARITY: 'Similarity',
    IMPLICATION: 'Implication',
    EQUIVALENCE: 'Equivalence',
    CONJUNCTION: 'Conjunction',
    TEMPORAL_RELATION: 'TemporalRelation',
    TRANSITIVITY: 'transitivity',
    SYMMETRY: 'symmetry',
    INDUCTION: 'induction',
    ANALOGY: 'analogy',
    TRANSITIVE_TEMPORAL: 'TransitiveTemporal',
};

export const EVENT_NAMES = {
    ADD_BELIEF: 'add-belief',
    NO_RULE_SELECTED: 'no_rule_selected',
};
