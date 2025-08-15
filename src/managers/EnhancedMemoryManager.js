import { AdvancedMemoryManager } from './AdvancedMemoryManager.js';
import { Budget } from '../support/Budget.js';

export class EnhancedMemoryManager extends AdvancedMemoryManager {
    constructor(nar) {
        super(nar);
        this.nar.config.minPriorityThreshold = this.nar.config.minPriorityThreshold || 0.01;
        this.nar.config.minDurabilityThreshold = this.nar.config.minDurabilityThreshold || 0.01;
    }

    /**
     * Allocate resources using a more dynamic and context-aware approach.
     * Overrides the method in AdvancedMemoryManager.
     * Incorporates logic from `_dynamicBudgetAllocation` in `doc/enhance.b.md`.
     */
    allocateResources(task, context = {}) {
        const initialBudget = super.allocateResources(task, context);

        let priority = initialBudget.priority;
        let durability = initialBudget.durability;
        let quality = initialBudget.quality;

        // Adjust based on system load
        const queueSize = this.nar.state.eventQueue.heap.length;
        const systemLoad = Math.min(queueSize / 1000, 1.0); // Normalize to 0-1

        // Reduce priority for low-value tasks when system is busy
        if (systemLoad > 0.7 && priority < 0.5) {
            priority *= (1 - systemLoad);
        }

        // Increase priority for high-value tasks when system is idle
        if (systemLoad < 0.3 && priority > 0.7) {
            priority += (0.3 - systemLoad) * 0.3;
        }

        // Adjust based on novelty of information
        if (context.noveltyScore) {
            priority = Math.min(priority + context.noveltyScore * 0.15, 1.0);
            quality = Math.min(quality + context.noveltyScore * 0.1, 1.0);
        }

        // Adjust based on task history (success)
        if (context.successHistory) {
            // Increase durability for tasks that historically lead to useful results
            durability = Math.min(durability + context.successHistory * 0.2, 1.0);
        }

        // Apply minimum thresholds to prevent starvation
        priority = Math.max(priority, this.nar.config.minPriorityThreshold);
        durability = Math.max(durability, this.nar.config.minDurabilityThreshold);

        return new Budget(priority, durability, quality);
    }

    /**
     * Resolve resource competition among a set of tasks.
     * From `doc/enhance.b.md`.
     */
    _resolveResourceCompetition(tasks) {
        if (!tasks || tasks.length === 0) {
            return [];
        }

        const scoredTasks = tasks.map(task => ({
            task,
            score: this._calculatePriorityScore(task)
        }));

        scoredTasks.sort((a, b) => b.score - a.score);

        const totalScore = scoredTasks.reduce((sum, t) => sum + t.score, 0);
        if (totalScore === 0) {
            return tasks.map(task => ({ task, budget: task.budget.scale(0) }));
        }

        const allocations = [];
        for (const { task, score } of scoredTasks) {
            const allocationRatio = score / totalScore;
            const allocatedBudget = task.budget.scale(allocationRatio);
            allocations.push({
                task,
                budget: allocatedBudget
            });
        }

        return allocations;
    }

    /**
     * Calculate a comprehensive priority score for a task.
     * From `doc/enhance.b.md`.
     */
    _calculatePriorityScore(task) {
        const { budget, activation = 0, pathLength = 0, temporalUrgency = 0 } = task;

        const priorityComponent = budget.priority * 0.4;
        const activationComponent = activation * 0.3;
        const qualityComponent = budget.quality * 0.2;
        const urgencyComponent = temporalUrgency * 0.1;

        const pathPenalty = 1 / (1 + pathLength * 0.1);

        return (priorityComponent + activationComponent + qualityComponent + urgencyComponent) *
               pathPenalty *
               this._calculateNoveltyBonus(task);
    }

    /**
     * Calculate a novelty bonus for potentially new information.
     * From `doc/enhance.b.md`.
     */
    _calculateNoveltyBonus(task) {
        if (!task.target) return 1.0;
        const hyperedge = this.nar.state.hypergraph.get(task.target);
        if (!hyperedge || hyperedge.beliefs.length === 0) return 1.2; // New concept gets bonus

        const newFrequency = task.truth ? task.truth.frequency : 0.5;
        const hasSignificantDifference = hyperedge.beliefs.some(b => Math.abs(b.truth.frequency - newFrequency) > 0.3);

        if (hasSignificantDifference) return 1.1; // Significant difference gets bonus

        return 1.0; // No bonus for similar beliefs
    }
}
