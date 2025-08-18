import {TruthValue} from '../../support/TruthValue.js';
import {Budget} from '../../support/Budget.js';
import {Hyperedge} from '../../support/Hyperedge.js';
import {id} from '../../support/utils.js';

export class CoreApi {
    constructor(nar) {
        this.nar = nar;
    }

    addHyperedge(type, args, options = {}) {
        const {truth, budget, priority, premises = [], derivedBy, temporal} = options;
        const termId = id(type, args);
        console.log('Adding hyperedge:', termId); // DEBUG
        let hyperedge = this.nar.state.hypergraph.get(termId);

        if (!hyperedge) {
            hyperedge = new Hyperedge(this.nar, termId, type, args);
            if (temporal) {
                hyperedge.temporal = temporal;
            }
            this.nar.state.hypergraph.set(termId, hyperedge);
            this.nar.state.index.addToIndex(hyperedge);
        }

        const finalTruth = truth || new TruthValue(1.0, 0.9);
        let finalBudget = budget;

        if (finalBudget && !(finalBudget instanceof Budget)) {
            finalBudget = new Budget(finalBudget.priority, finalBudget.durability, finalBudget.quality);
        } else if (!finalBudget) {
            finalBudget = this.nar.memoryManager.allocateResources({type: 'revision'}, {importance: priority});
        }

        const revisionResult = hyperedge.revise({
            truth: finalTruth,
            budget: finalBudget,
            beliefCapacity: this.nar.config.beliefCapacity,
            premises,
            context: options.context,
            derivedBy
        });

        if (revisionResult.needsUpdate) {
            this.nar.contradictionManager.detectContradictions(termId);
            if (this.nar.contradictionManager.detectAndResolveInterEdgeContradictions) {
                this.nar.contradictionManager.detectAndResolveInterEdgeContradictions(hyperedge);
            }
            this.nar.emit('revision', {hyperedgeId: termId, newTruth: finalTruth, newBudget: finalBudget});

            // Boost budget for meta-learning beliefs to ensure they are processed
            let budgetForPropagation = finalBudget;
            if (type === 'Inheritance' && args[0].startsWith('Term(*,')) {
                budgetForPropagation = new Budget(1.0, 1.0, 1.0);
            }

            this.nar.propagation.propagate({
                target: termId,
                activation: 1.0,
                budget: budgetForPropagation,
                pathHash: 0,
                pathLength: 0,
                derivationPath: []
            });
            this.nar.questionHandler.checkQuestionAnswers(termId, hyperedge.getStrongestBelief());
        }

        return termId;
    }

    outcome(context, outcome, options = {}) {
        this.nar.learningEngine.recordExperience(context, outcome, options);
    }

    revise(hyperedgeId, options = {}) {
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        if (!hyperedge) {
            this.nar._log('warn', `revise called on non-existent hyperedge: ${hyperedgeId}`);
            return;
        }

        const {truth, budget} = options;
        const strongestBelief = hyperedge.getStrongestBelief();

        const finalTruth = truth || strongestBelief?.truth;
        let finalBudget = budget || strongestBelief?.budget;

        if (!finalTruth || !finalBudget) {
            return;
        }

        if (finalBudget && !(finalBudget instanceof Budget)) {
            finalBudget = new Budget(finalBudget.priority, finalBudget.durability, finalBudget.quality);
        }

        const revisionResult = hyperedge.revise({
            truth: finalTruth,
            budget: finalBudget,
            beliefCapacity: this.nar.config.beliefCapacity,
            premises: strongestBelief?.premises,
            derivedBy: 'revision'
        });

        if (revisionResult.needsUpdate) {
            this.nar.contradictionManager.detectContradictions(hyperedgeId);
            this.nar.emit('revision', {hyperedgeId, newTruth: finalTruth, newBudget: finalBudget});
            this.nar.propagation.propagate({
                target: hyperedgeId,
                activation: 1.0,
                budget: finalBudget,
                pathHash: 0,
                pathLength: 0,
                derivationPath: []
            });
        }
    }

    removeHyperedge(hyperedgeId) {
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        if (hyperedge) {
            this.nar.state.hypergraph.delete(hyperedgeId);
            if (this.nar.state.index.structural) {
                this.nar.state.index.structural.removeFromIndex(hyperedge);
            } else {
                this.nar.state.index.removeFromIndex(hyperedge);
            }
            this.nar.state.activations.delete(hyperedgeId);
            this.nar.emit('knowledge-pruned', {hyperedgeId, type: hyperedge.type});
            return true;
        }
        return false;
    }
}
