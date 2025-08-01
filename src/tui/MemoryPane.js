import blessed from 'neo-blessed';
import { Component } from './Component.js';

export class MemoryPane extends Component {
    createWidget() {
        const layout = blessed.layout({
            parent: this.parent,
            label: 'Memory Explorer (F3)',
            border: 'line',
            style: { border: { fg: 'magenta' } },
            ...this.options
        });

        this.list = blessed.list({
            parent: layout,
            width: '100% - 2',
            height: '100% - 2',
            keys: true,
            vi: true,
            mouse: true,
            style: {
                selected: { bg: 'blue' }
            },
            label: 'Top 100 Concepts by Budget'
        });

        return layout;
    }

    update(nar) {
        if (!nar || !nar.state || !nar.state.hypergraph) return;

        const concepts = Array.from(nar.state.hypergraph.values());

        concepts.sort((a, b) => {
            const beliefA = a.getStrongestBelief();
            const beliefB = b.getStrongestBelief();
            const budgetA = beliefA ? beliefA.budget.total() : 0;
            const budgetB = beliefB ? beliefB.budget.total() : 0;
            return budgetB - budgetA;
        });

        const items = concepts.slice(0, 100).map(c => {
            const belief = c.getStrongestBelief();
            const budget = belief?.budget;
            const truth = belief?.truth;
            const budgetStr = budget ? `B:${budget.priority.toFixed(2)}` : 'B:N/A';
            const truthStr = truth ? `T:${truth.frequency.toFixed(2)},${truth.confidence.toFixed(2)}` : 'T:N/A';
            return `${c.id.padEnd(40, ' ')} | ${budgetStr} | ${truthStr}`;
        });

        this.list.setItems(items);
        this.render();
    }

    focus() {
        this.list.focus();
    }
}
