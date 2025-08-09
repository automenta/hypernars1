export class StructuralApi {
    constructor(nar, api) {
        this.nar = nar;
        this.api = api;
    }

    term(name, options = {}) {
        return this.api.addHyperedge('Term', [name], options);
    }

    inheritance(subject, predicate, options = {}) {
        return this.api.addHyperedge('Inheritance', [subject, predicate], options);
    }

    similarity(term1, term2, options = {}) {
        return this.api.addHyperedge('Similarity', [term1, term2], options);
    }

    implication(premise, conclusion, options = {}) {
        return this.api.addHyperedge('Implication', [premise, conclusion], options);
    }

    equivalence(premise, conclusion, options = {}) {
        return this.api.addHyperedge('Equivalence', [premise, conclusion], options);
    }
}
