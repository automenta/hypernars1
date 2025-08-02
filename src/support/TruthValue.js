import {clamp} from './utils.js';

export class TruthValue {
  constructor(frequency, confidence, priority = 1.0, doubt = 0.0) {
    this.frequency = clamp(frequency, 0, 1);
    this.confidence = clamp(confidence, 0, 1);
    this.priority = clamp(priority, 0, 1);
    this.doubt = clamp(doubt, 0, 1);
  }

  expectation() {
    const { confidence } = this;
    const baseExpectation = this.frequency * confidence / (confidence + (1 - confidence));
    return baseExpectation * (1 - this.doubt);
  }

  scale(factor) {
    return new TruthValue(
      clamp(this.frequency * factor, 0, 1),
      clamp(this.confidence * factor, 0, 1),
      clamp(this.priority * factor, 0, 1),
      clamp(this.doubt * factor, 0, 1)
    );
  }

  static revise(t1, t2) {
    const total = t1.priority + t2.priority;
    const doubt1 = t1.doubt || 0;
    const doubt2 = t2.doubt || 0;

    const doubt = Math.min(1.0, (doubt1 + doubt2) * 0.6 + Math.abs(t1.frequency - t2.frequency) * 0.4);

    return new TruthValue(
      (t1.frequency * t1.priority + t2.frequency * t2.priority) / total,
      (t1.confidence * t1.priority + t2.confidence * t2.priority) / total,
      Math.min(total, 1.0),
      doubt
    );
  }

  static transitive(t1, t2) {
    const f1 = t1.frequency, c1 = t1.confidence;
    const f2 = t2.frequency, c2 = t2.confidence;

    const frequency = f1 * f2;
    const confidence = c1 * c2 * Math.max(0, 1 - Math.abs(f1 - f2));
    const doubt = Math.max(t1.doubt || 0, t2.doubt || 0);

    return new TruthValue(frequency, confidence, Math.min(t1.priority, t2.priority) * 0.8, doubt);
  }

  static induction(t1, t2) {
    const f1 = t1.frequency, c1 = t1.confidence;
    const f2 = t2.frequency, c2 = t2.confidence;

      //TODO check this
    const frequency = (f1 + f2) / 2;
    const confidence = c1 * c2 * (1 - Math.abs(f1 - f2));
    const doubt = Math.max(t1.doubt || 0, t2.doubt || 0);

    return new TruthValue(frequency, confidence, Math.min(t1.priority, t2.priority) * 0.7, doubt);
  }

  static deduced(t1, t2) {
    const f1 = t1.frequency, c1 = t1.confidence;
    const f2 = t2.frequency, c2 = t2.confidence;

    const frequency = (f1 + f2) / 2;
    const confidence = c1 * c2 * (1 - Math.abs(f1 - f2));
    const doubt = Math.max(t1.doubt || 0, t2.doubt || 0);

    return new TruthValue(frequency, confidence, Math.min(t1.priority, t2.priority), doubt);
  }

  static abduction(t1, t2) {
    const f1 = t1.frequency, c1 = t1.confidence;
    const f2 = t2.frequency, c2 = t2.confidence;

    const frequency = f2;
      const confidence = c1 * c2 * f1;
    const doubt = Math.max(t1.doubt || 0, t2.doubt || 0);

    return new TruthValue(frequency, confidence, Math.min(t1.priority, t2.priority) * 0.7, doubt);
  }

  static analogy(t1, t2) {
    const f1 = t1.frequency, c1 = t1.confidence;
    const f2 = t2.frequency, c2 = t2.confidence;

      const frequency = f1 * f2;
      const confidence = c1 * c2 * f2;
    const doubt = Math.max(t1.doubt || 0, t2.doubt || 0);

    return new TruthValue(frequency, confidence, Math.min(t1.priority, t2.priority) * 0.7, doubt);
  }

  negate() {
    return new TruthValue(1.0 - this.frequency, this.confidence, this.priority, this.doubt);
  }

  static negation(t1) {
    return new TruthValue(1.0 - t1.frequency, t1.confidence, t1.priority, t1.doubt || 0);
  }

  static certain() {
    return new TruthValue(1.0, 0.9, 1.0, 0.0);
  }

  static unknown() {
    return new TruthValue(0.5, 0.1, 0.1, 0.0);
  }

  equivalent(other, threshold = 0.01) {
    return Math.abs(this.frequency - other.frequency) < threshold &&
           Math.abs(this.confidence - other.confidence) < threshold &&
           Math.abs((this.doubt || 0) - (other.doubt || 0)) < threshold;
  }

  toJSON() {
    return {
      frequency: this.frequency,
      confidence: this.confidence,
      priority: this.priority,
      doubt: this.doubt,
    };
  }
}
