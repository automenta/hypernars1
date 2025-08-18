import {extractTerms} from '../../support/termExtraction.js';

export class ImportanceManager {
    constructor(memoryManager) {
        this.memoryManager = memoryManager;
        this.nar = memoryManager.nar;
        this.config = memoryManager.config;
    }

    updateImportanceScores() {
        this.memoryManager.importanceScores.forEach((score, termId) => {
            this.memoryManager.importanceScores.set(termId, score * this.config.importanceDecayFactor);
        });

        this.nar.state.activations.forEach((activation, termId) => {
            const currentScore = this.memoryManager.importanceScores.get(termId) || 0;
            const newScore = (currentScore * (1 - this.config.importanceActivationWeight)) + (activation * this.config.importanceActivationWeight);
            this.memoryManager.importanceScores.set(termId, Math.min(1.0, newScore));
        });

        const importantTerms = new Set();
        this.nar.state.questionPromises.forEach((promise, questionId) => {
            try {
                const match = questionId.match(/^Question\((.*)\)\|.*$/);
                if (match) {
                    const questionContent = match[1];
                    const cleanedQuestionContent = questionContent.endsWith('?') ? questionContent.slice(0, -1) : questionContent;
                    const parsedQuestion = this.nar.expressionEvaluator.parse(cleanedQuestionContent);
                    extractTerms(parsedQuestion, importantTerms);
                }
            } catch (e) {
            }
        });

        importantTerms.forEach(termId => {
            const currentScore = this.memoryManager.importanceScores.get(termId) || 0;
            this.memoryManager.importanceScores.set(termId, Math.min(1.0, currentScore + this.config.importanceQuestionWeight));
        });

        this.nar.learningEngine.recentSuccesses?.forEach(termId => {
            const currentScore = this.memoryManager.importanceScores.get(termId) || 0;
            this.memoryManager.importanceScores.set(termId, Math.min(1.0, currentScore + this.config.importanceSuccessWeight));
        });

        if (this.memoryManager.contextStack.length > 0) {
            const currentContext = this.memoryManager.contextStack[this.memoryManager.contextStack.length - 1];
            currentContext.forEach(termId => {
                const currentScore = this.memoryManager.importanceScores.get(termId) || 0;
                this.memoryManager.importanceScores.set(termId, Math.min(1.0, currentScore + this.config.importanceContextWeight));
            });
        }

        if (this.nar.goalManager && this.nar.goalManager.getActiveGoals) {
            const activeGoals = this.nar.goalManager.getActiveGoals();
            activeGoals.forEach(goal => {
                const relatedTerms = this.nar.goalManager.getRelatedTerms(goal.id);
                relatedTerms.forEach(termId => {
                    const currentScore = this.memoryManager.importanceScores.get(termId) || 0;
                    this.memoryManager.importanceScores.set(termId, Math.min(1.0, currentScore + this.config.importanceGoalWeight * goal.priority));
                });
            });
        }
    }
}
