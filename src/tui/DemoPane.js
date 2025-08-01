import blessed from 'neo-blessed';
import { Component } from './Component.js';

export class DemoPane extends Component {
    createWidget() {
        const layout = blessed.layout({
            parent: this.parent,
            label: 'Demos',
            width: '30%',
            height: '50%',
            left: 0,
            bottom: 0,
            border: 'line',
            style: {
                border: { fg: 'yellow' }
            },
            ...this.options
        });

        this.list = blessed.list({
            parent: layout,
            top: 0,
            left: 0,
            width: '100% - 2',
            height: '100% - 4',
            keys: true,
            vi: true,
            mouse: true,
            border: 'line',
            style: {
                selected: { bg: 'blue' }
            },
            label: 'Available Demos'
        });

        this.runButton = blessed.button({
            parent: layout,
            content: 'Run Selected',
            bottom: 0,
            left: 'center',
            shrink: true,
            mouse: true,
            keys: true,
            style: {
                fg: 'white',
                bg: 'green',
                focus: { bg: 'red' }
            }
        });

        this.descriptionBox = blessed.box({
            parent: layout,
            content: '',
            bottom: 3,
            left: 1,
            width: '100% - 4',
            height: 1,
        });

        this.list.on('select item', (item, index) => {
            const demo = this.options.demos[index];
            if (demo) {
                this.descriptionBox.setContent(demo.description || '');
                this.render();
            }
        });

        this.runButton.on('press', () => {
            const selectedIndex = this.list.selected;
            if (this.options.onRunDemo && selectedIndex != null) {
                const demo = this.options.demos[selectedIndex];
                this.options.onRunDemo(demo);
            }
        });

        return layout;
    }

    setDemos(demos) {
        this.options.demos = demos;
        this.list.setItems(demos.map(d => d.name));
        this.render();
    }

    focus() {
        this.list.focus();
    }
}
