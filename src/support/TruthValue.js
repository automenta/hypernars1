import {clamp} from './utils.js';

export class TruthValue {
    constructor(frequency, confidence, priority = 1.0, doubt = 0.0) {
        this.frequency = clamp(frequency, 0, 1);
        this.confidence = clamp(confidence, 0, 1);
        this.priority = clamp(priority, 0, 1);
        this.doubt = clamp(doubt, 0, 1);
    }

    static revise(t1, t2) {
        const totalPriority = t1.priority + t2.priority;
        const revisedFrequency = (t1.frequency * t1.priority + t2.frequency * t2.priority) / totalPriority;
        const revisedConfidence = 1 - (1 - t1.confidence) * (1 - t2.confidence);
        const doubt1 = t1.doubt || 0;
        const doubt2 = t2.doubt || 0;
        const doubt = Math.min(1.0, (doubt1 + doubt2) * 0.6 + Math.abs(t1.frequency - t2.frequency) * 0.4);

        return new TruthValue(
            revisedFrequency,
            revisedConfidence,
            Math.min(totalPriority, 1.0),
            doubt
        );
    }

    static transitive(t1, t2) {
        const f1 = t1.frequency, c1 = t1.confidence;
        const f2 = t2.frequency, c2 = t2.confidence;

        const frequency = f1 * f2;
        const confidence = c1 * c2;
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

    static negation(t1) {
        return new TruthValue(1.0 - t1.frequency, t1.confidence, t1.priority, t1.doubt || 0);
    }

    static resolveContradiction(t_pro, t_con) {
        const c_pro = t_pro.confidence;
        const c_con = t_con.confidence;

        // Using the evidence system (w = c / (1-c))
        const w_pro = c_pro / (1 - c_pro);
        const w_con = c_con / (1 - c_con);

        const w_final = w_pro - w_con;
        const c_final = Math.abs(w_final) / (Math.abs(w_final) + 1);

        // Frequency is a weighted average of the pro-frequency and the negated con-frequency
        const f_pro = t_pro.frequency;
        const f_con_negated = 1.0 - t_con.frequency;

        // Use confidence as the weight for the frequency calculation
        const f_final = (f_pro * c_pro + f_con_negated * c_con) / (c_pro + c_con);

        // If w_final is negative, the belief flips, but we'll let the expectation handle the sign
        // For now, the frequency represents the belief in the "pro" statement
        return new TruthValue(f_final, c_final);
    }

    static certain() {
        return new TruthValue(1.0, 0.9, 1.0, 0.0);
    }

    static unknown() {
        return new TruthValue(0.5, 0.1, 0.1, 0.0);
    }

    expectation() {
        const {frequency, confidence, doubt} = this;
        const e = (confidence * (frequency - 0.5)) + 0.5;
        return e * (1 - (doubt || 0));
    }

    scale(factor) {
        return new TruthValue(
            clamp(this.frequency * factor, 0, 1),
            clamp(this.confidence * factor, 0, 1),
            clamp(this.priority * factor, 0, 1),
            clamp(this.doubt * factor, 0, 1)
        );
    }

    negate() {
        return new TruthValue(1.0 - this.frequency, this.confidence, this.priority, this.doubt);
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
