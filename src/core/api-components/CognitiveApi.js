export class CognitiveApi {
    constructor(nar) {
        this.nar = nar;
    }

    getTrace(depth) {
        return this.nar.cognitiveExecutive.getTrace(depth);
    }

    configureStrategy(config) {
        return this.nar.cognitiveExecutive.configureStrategy(config);
    }

    getActiveStrategy() {
        return this.nar.cognitiveExecutive.getActiveStrategy();
    }

    getMetrics() {
        const history = this.nar.cognitiveExecutive.metricsHistory;
        return history[history.length - 1] || null;
    }

    getFocus() {
        return this.nar.cognitiveExecutive.currentFocus;
    }
}
