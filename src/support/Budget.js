import { clamp } from './utils.js';

export class Budget {
  constructor(priority, durability, quality) {
    this.priority = clamp(priority, 0, 1);
    this.durability = clamp(durability, 0, 1);
    this.quality = clamp(quality, 0, 1);
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

  static full() {
    return new Budget(1.0, 1.0, 1.0);
  }

  toJSON() {
    return {
      priority: this.priority,
      durability: this.durability,
      quality: this.quality,
    };
  }
}
