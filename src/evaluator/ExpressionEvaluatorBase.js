/**
 * A base class for expression evaluators.
 */
export class ExpressionEvaluatorBase {
    constructor(nar) {
        this.nar = nar;
    }

    parseAndAdd(nalStatement, options = {}) {
        throw new Error("parseAndAdd must be implemented by subclasses");
    }

    parseQuestion(question, options = {}) {
        throw new Error("parseQuestion must be implemented by subclasses");
    }

    query(pattern, options = {}) {
        throw new Error("query must be implemented by subclasses");
    }
}
