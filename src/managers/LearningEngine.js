import { id } from '../support/utils.js';
import { TruthValue } from '../support/TruthValue.js';
import { LearningEngineBase } from './LearningEngineBase.js';

export class LearningEngine extends LearningEngineBase {
    constructor(nar) {
        super(nar);
        this.experienceBuffer = [];
        this.patternMemory = new Map();
        this.learningRate = 0.1;
    }

    applyLearning() {
        if (this.experienceBuffer.length === 0) return;

        this._processRecentExperiences();
        this._discoverPatterns();
        this._createRulesFromPatterns();

        // Clear buffer periodically
        if (this.experienceBuffer.length > 500) {
            this.experienceBuffer = this.experienceBuffer.slice(-250);
        }
    }

    recordExperience(event, outcome = {}) {
        const { success, accuracy } = outcome;
        const hyperedge = this.nar.hypergraph.get(event.target);
        const belief = hyperedge?.getStrongestBelief();

        const experience = {
            id: `Exp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            timestamp: Date.now(),
            derivationPath: event.derivationPath,
            target: event.target,
            premises: belief?.premises || [],
            conclusion: event.target,
            budget: event.budget,
            success,
            accuracy
        };

        this.experienceBuffer.push(experience);
        if (this.experienceBuffer.length > 1000) {
            this.experienceBuffer.shift();
        }

        // Immediately process significant experiences
        if (success === false || (accuracy !== undefined && Math.abs(accuracy) < 0.3)) {
            this._analyzeFailure(experience);
        } else if (success === true && accuracy > 0.8) {
            this._reinforceSuccess(experience);
        }
    }

    _processRecentExperiences() {
        const recent = this.experienceBuffer.slice(-100);
        if (recent.length === 0) return;

        // Update strategy effectiveness in MetaReasoner
        recent.forEach(exp => {
            if (exp.derivationPath && exp.derivationPath.length > 0) {
                const pathKey = exp.derivationPath.join('->');
                this.nar.metaReasoner.trackOutcome(
                    `path:${pathKey}`,
                    exp.success ? 'success' : 'failure',
                    { accuracy: exp.accuracy }
                );
            }
        });
    }

    _discoverPatterns() {
        const patternCandidates = this._extractPatternCandidates();

        patternCandidates.forEach(candidate => {
            const signature = this._patternSignature(candidate);
            if (!this.patternMemory.has(signature)) {
                this.patternMemory.set(signature, { instances: [], successCount: 0, totalCount: 0, averageAccuracy: 0 });
            }

            const pattern = this.patternMemory.get(signature);
            pattern.instances.push(candidate);
            pattern.totalCount++;
            if (candidate.success) pattern.successCount++;
            pattern.averageAccuracy = (pattern.averageAccuracy * (pattern.totalCount - 1) + (candidate.accuracy || 0.5)) / pattern.totalCount;

            if (pattern.instances.length > 50) pattern.instances.shift();
        });
    }

    _extractPatternCandidates() {
        return this.experienceBuffer
            .filter(e => e.success && e.premises && e.premises.length > 0)
            .map(e => ({
                premises: e.premises,
                conclusion: e.conclusion,
                accuracy: e.accuracy,
                success: e.success
            }));
    }

    _patternSignature(pattern) {
        // Create a signature based on the structure of the rule
        const premiseTypes = pattern.premises.map(p => this.nar.hypergraph.get(p)?.type || 'Term').sort().join(',');
        const conclusionType = this.nar.hypergraph.get(pattern.conclusion)?.type || 'Term';
        return `${premiseTypes}=>${conclusionType}`;
    }

    _createRulesFromPatterns() {
        for (const [signature, patternData] of this.patternMemory) {
            const successRate = patternData.successCount / patternData.totalCount;
            if (successRate > 0.8 && patternData.totalCount > 5) {
                const representativeInstance = patternData.instances[patternData.instances.length - 1];
                this._createShortcutRule(representativeInstance.premises, representativeInstance.conclusion, successRate);
                // Reset pattern to avoid re-creating the rule
                this.patternMemory.delete(signature);
            }
        }
    }

    _createShortcutRule(premises, conclusionId, confidence) {
        if (!premises || premises.length === 0) return;

        // Create a conjunction of all premises for a more accurate rule
        const premiseConjunctionId = this.nar.conjunction(...premises);

        const shortcutId = id('LearnedRule', [premiseConjunctionId, conclusionId]);
        if (!this.nar.hypergraph.has(shortcutId)) {
            this.nar.addHyperedge('Implication', [premiseConjunctionId, conclusionId], {
                truth: new TruthValue(0.9, confidence),
                budget: this.nar.budget(0.9, 0.9, 0.9),
                premises: [] // Learned rules are atomic
            });
            this.nar.notifyListeners('shortcut-created', { from: premiseConjunctionId, to: conclusionId, confidence });
        }
    }

    _analyzeFailure(experience) {
        if (!experience.derivationPath) return;

        // Weaken the beliefs along the derivation path that led to failure
        experience.derivationPath.forEach((stepKey, index) => {
            const event = this.nar.eventQueue.heap.find(e => e.derivationPath.join('->').endsWith(stepKey));
            if (!event) return;

            const hyperedge = this.nar.hypergraph.get(event.target);
            if (hyperedge) {
                const learningFactor = this.learningRate * Math.pow(0.8, experience.derivationPath.length - 1 - index);
                const currentTruth = hyperedge.getTruth();
                const newTruth = new TruthValue(
                    currentTruth.frequency,
                    currentTruth.confidence * (1 - learningFactor) // Reduce confidence
                );
                this.nar.revise(event.target, newTruth, hyperedge.getStrongestBelief().budget.scale(0.9));
            }
        });
    }

    _reinforceSuccess(experience) {
        if (!experience.derivationPath) return;

        // Strengthen the beliefs along the derivation path that led to success
        experience.derivationPath.forEach((stepKey, index) => {
            const event = this.nar.eventQueue.heap.find(e => e.derivationPath.join('->').endsWith(stepKey));
            if (!event) return;

            const hyperedge = this.nar.hypergraph.get(event.target);
            if (hyperedge) {
                const learningFactor = this.learningRate * Math.pow(0.9, index);
                const currentTruth = hyperedge.getTruth();
                const newTruth = new TruthValue(
                    currentTruth.frequency,
                    Math.min(0.99, currentTruth.confidence * (1 + learningFactor)) // Increase confidence
                );
                this.nar.revise(event.target, newTruth, hyperedge.getStrongestBelief().budget.scale(1.05));
            }
        });
    }
}
