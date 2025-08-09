export const advancedDerivationEngineConfig = {
    ruleRecencyFactor: 0.995,
    ruleSuccessRateWeight: 0.7,
    ruleApplicabilityWeight: 0.3,
    ruleSuccessRateLearningRate: 0.1,

    transitiveInheritanceBudgetFactor: 0.7,
    transitiveInheritanceActivationFactor: 1.0,
    similarityFromInheritanceBudgetFactor: 0.6,
    similarityFromInheritanceActivationFactor: 1.0,
    propertyInheritanceBudgetFactor: 0.5,
    propertyInheritanceActivationFactor: 0.6,

    similaritySymmetryBudgetFactor: 0.9,
    inductiveSimilarityBudgetFactor: 0.6,
    analogyBudgetFactor: 0.6,

    implicationActivationFactor: 0.9,
    implicationBudgetFactor: 0.75,
    equivalenceBudgetFactor: 0.8,
    conjunctionActivationFactor: 0.9,
    conjunctionBudgetFactor: 0.75,
    transitiveTemporalBudgetFactor: 0.7,

    boostFactor: 0.1,
    penalizeFactor: 0.1
};
