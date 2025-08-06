export class TemporalIndex {
    constructor() {

        this.events = [];
    }

    add(event) {
        if (event && event.startTime !== undefined && event.endTime !== undefined) {
            this.events.push(event);
        }
    }

    remove(event) {
        this.events = this.events.filter(e => e !== event);
    }

    query(startTime, endTime) {

        return this.events.filter(event =>
            event.startTime < endTime && event.endTime > startTime
        );
    }

    clear() {
        this.events = [];
    }
}
