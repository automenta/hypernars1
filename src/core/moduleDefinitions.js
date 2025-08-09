import {ExpressionEvaluator} from '../evaluator/ExpressionEvaluator.js';
import {AdvancedExpressionEvaluator} from '../evaluator/AdvancedExpressionEvaluator.js';
import {DerivationEngineBase} from './DerivationEngineBase.js';
import {SimpleDerivationEngine} from './SimpleDerivationEngine.js';
import {AdvancedDerivationEngine} from './AdvancedDerivationEngine.js';
import {MemoryManagerBase} from '../managers/MemoryManagerBase.js';
import {SimpleMemoryManager} from '../managers/SimpleMemoryManager.js';
import {AdvancedMemoryManager} from '../managers/AdvancedMemoryManager.js';
import {ContradictionManagerBase} from '../managers/ContradictionManagerBase.js';
import {SimpleContradictionManager} from '../managers/SimpleContradictionManager.js';
import {AdvancedContradictionManager} from '../managers/AdvancedContradictionManager.js';
import {LearningEngineBase} from '../managers/LearningEngineBase.js';
import {SimpleLearningEngine} from '../managers/SimpleLearningEngine.js';
import {AdvancedLearningEngine} from '../managers/AdvancedLearningEngine.js';
import {TemporalManagerBase} from '../managers/TemporalManagerBase.js';
import {SimpleTemporalManager} from '../managers/SimpleTemporalManager.js';
import {TemporalReasoner} from '../managers/TemporalReasoner.js';
import {CognitiveExecutive} from '../managers/CognitiveExecutive.js';
import {ExplanationSystem} from '../managers/ExplanationSystem.js';
import {GoalManagerBase} from '../managers/GoalManagerBase.js';
import {GoalManager} from '../managers/GoalManager.js';
import {ConceptFormation} from '../managers/ConceptFormation.js';

export const MODULE_DEFINITIONS = [
    {name: 'ExpressionEvaluator', simple: ExpressionEvaluator, advanced: AdvancedExpressionEvaluator},
    {
        name: 'DerivationEngine',
        simple: SimpleDerivationEngine,
        advanced: AdvancedDerivationEngine,
        base: DerivationEngineBase
    },
    {name: 'MemoryManager', simple: SimpleMemoryManager, advanced: AdvancedMemoryManager, base: MemoryManagerBase},
    {
        name: 'ContradictionManager',
        simple: SimpleContradictionManager,
        advanced: AdvancedContradictionManager,
        base: ContradictionManagerBase
    },
    {name: 'LearningEngine', simple: SimpleLearningEngine, advanced: AdvancedLearningEngine, base: LearningEngineBase},
    {name: 'TemporalManager', simple: SimpleTemporalManager, advanced: TemporalReasoner, base: TemporalManagerBase},
    {name: 'CognitiveExecutive', simple: CognitiveExecutive},
    {name: 'ExplanationSystem', simple: ExplanationSystem},
    {name: 'GoalManager', simple: GoalManager, base: GoalManagerBase},
    {name: 'ConceptFormation', simple: ConceptFormation},
];
