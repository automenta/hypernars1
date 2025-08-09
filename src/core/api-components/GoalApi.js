export class GoalApi {
    constructor(nar) {
        this.nar = nar;
    }

    addGoal(description, utility, constraints = {}, options = {}) {
        return this.nar.goalManager.addGoal(description, utility, constraints, options);
    }

    getGoals() {
        return this.nar.goalManager.getActiveGoals();
    }
}
