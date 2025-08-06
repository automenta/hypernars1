import {clamp} from './utils.js';
import { TASK_TYPES } from './constants.js';

export class Budget {
    constructor(priority, durability, quality) {
        this.priority = clamp(priority, 0, 1);
        this.durability = clamp(durability, 0, 1);
        this.quality = clamp(quality, 0, 1);
    }

    static full() {
        return new Budget(1.0, 1.0, 1.0);
    }

    static dynamicAllocate(task, context = {}) {
        let basePriority = 0.5;
        switch (task.type) {
            case TASK_TYPES.QUESTION:
                basePriority = 0.9;
                break;
            case TASK_TYPES.CRITICAL_EVENT:
                basePriority = 0.95;
                break;
            case TASK_TYPES.GOAL:
                basePriority = 0.85;
                break;
            case TASK_TYPES.DERIVATION:
                basePriority = 0.6;
                break;
            case TASK_TYPES.REVISION:
                basePriority = 0.7;
                break;
        }


        if (context.urgency) {
            basePriority = Math.min(1.0, basePriority + context.urgency * 0.3);
        }
        if (context.importance) {
            basePriority = Math.min(1.0, basePriority + context.importance * 0.2);
        }
        if (context.noveltyScore) {
            basePriority = Math.min(1.0, basePriority + context.noveltyScore * 0.15);
        }


        const systemLoad = context.systemLoad || 0;
        const availability = Math.max(0.1, 1.0 - systemLoad * 0.7);
        let priority = basePriority * availability;


        let durability = 0.6;
        if (task.type === TASK_TYPES.QUESTION || task.type === TASK_TYPES.CRITICAL_EVENT || task.type === TASK_TYPES.GOAL) {
            durability = 0.9;
        }
        if (context.successHistory) {
            durability = Math.min(durability + context.successHistory * 0.2, 1.0);
        }



        let quality = Math.sqrt(availability) * 0.8;
        if (context.noveltyScore) {
            quality = Math.min(quality + context.noveltyScore * 0.1, 1.0);
        }


        priority = Math.max(priority, context.minPriorityThreshold || 0.01);
        durability = Math.max(durability, context.minDurabilityThreshold || 0.01);

        return new Budget(priority, durability, quality);
    }

    total() {
        return (this.priority + this.durability + this.quality) / 3;
    }

    scale(factor) {
        return new Budget(
            clamp(this.priority * factor, 0, 1),
            clamp(this.durability * factor, 0, 1),
            clamp(this.quality * factor, 0, 1)
        );
    }

    merge(other) {
        return new Budget(
            (this.priority + other.priority) / 2,
            (this.durability + other.durability) / 2,
            (this.quality + other.quality) / 2
        );
    }

    equivalent(other) {
        const threshold = 0.05;
        return Math.abs(this.priority - other.priority) < threshold &&
            Math.abs(this.durability - other.durability) < threshold &&
            Math.abs(this.quality - other.quality) < threshold;
    }

    toJSON() {
        return {
            priority: this.priority,
            durability: this.durability,
            quality: this.quality,
        };
    }
}
