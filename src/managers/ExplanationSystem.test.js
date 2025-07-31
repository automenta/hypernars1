import { describe, it, expect } from '@jest/globals';
import { NARHyper } from '../NARHyper.js';

describe('ExplanationSystem', () => {
    it('should identify a direct assertion', () => {
        const nar = new NARHyper();
        const termId = nar.nal('term.');
        const explanation = nar.explain(termId, { depth: 1, format: 'json' });
        const path = JSON.parse(explanation);
        expect(path[0].derivationRule).toBe('assertion');
    });

    it('should identify transitive inheritance', () => {
        const nar = new NARHyper();
        const p1 = nar.inheritance('A', 'B');
        const p2 = nar.inheritance('B', 'C');

        // Manually create the conclusion with premises
        const conclusion = nar.inheritance('A', 'C', { premises: [p1, p2] });

        const explanation = nar.explain(conclusion, { depth: 3, format: 'json' });
        const path = JSON.parse(explanation);

        // Find the conclusion step in the path
        const conclusionStep = path.find(step => step.id === conclusion);
        expect(conclusionStep).toBeDefined();
        expect(conclusionStep.derivationRule).toBe('transitivity');
    });

    it('should identify analogy', () => {
        const nar = new NARHyper();
        const p1 = nar.similarity('A', 'B');
        const p2 = nar.inheritance('A', 'C');

        // Manually create the conclusion with premises
        const conclusion = nar.inheritance('B', 'C', { premises: [p1, p2] });

        const explanation = nar.explain(conclusion, { depth: 3, format: 'json' });
        const path = JSON.parse(explanation);

        const conclusionStep = path.find(step => step.id === conclusion);
        expect(conclusionStep).toBeDefined();
        expect(conclusionStep.derivationRule).toBe('analogy');
    });

    it('should fallback to "derived" for unknown patterns', () => {
        const nar = new NARHyper();
        const p1 = nar.nal('premise1.');
        const conclusion = nar.implication('premise1', 'conclusion', { premises: [p1] });

        const explanation = nar.explain(conclusion, { depth: 2, format: 'json' });
        const path = JSON.parse(explanation);

        const conclusionStep = path.find(step => step.id === conclusion);
        expect(conclusionStep).toBeDefined();
        expect(conclusionStep.derivationRule).toBe('derived');
    });
});
