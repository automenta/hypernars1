export class Goal {
    constructor(id, description, utility, constraints = {}, options = {}) {
        this.id = id;
        this.description = description;
        this.utility = utility;
        this.constraints = constraints;
        this.status = 'active';
        this.priority = options.priority || 0.5;
        this.creationTime = Date.now();
        this.deadline = constraints.deadline || Infinity;
        this.achievers = new Set();
    }

    get urgency() {
        if (this.deadline === Infinity) return this.priority * this.utility;
        const timeLeft = this.deadline - Date.now();
        if (timeLeft <= 0) return Infinity;

        return (this.priority * this.utility) / Math.log1p(timeLeft / 1000);
    }
}
