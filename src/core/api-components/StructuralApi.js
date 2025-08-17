export class StructuralApi {
    constructor(nar, api) {
        this.nar = nar;
        this.api = api;
    }

    term(name, options = {}) {
        const termId = this.api.addHyperedge('Term', [name], options);
        return termId;
    }

    inheritance(subject, predicate, options = {}) {
        const termId = this.api.addHyperedge('Inheritance', [subject, predicate], options);
        return termId;
    }

    similarity(term1, term2, options = {}) {
        const termId = this.api.addHyperedge('Similarity', [term1, term2], options);
        return termId;
    }

    implication(premise, conclusion, options = {}) {
        const termId = this.api.addHyperedge('Implication', [premise, conclusion], options);
        return termId;
    }

    equivalence(premise, conclusion, options = {}) {
        const termId = this.api.addHyperedge('Equivalence', [premise, conclusion], options);
        return termId;
    }
}
