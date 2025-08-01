import blessed from 'neo-blessed';
import { Component } from './Component.js';

export class ControlPane extends Component {
    createWidget() {
        const layout = blessed.layout({
            parent: this.parent,
            label: 'Controls',
            width: '30%',
            height: '50%',
            right: 0,
            top: 0,
            border: 'line',
            style: {
                border: { fg: 'green' }
            },
            ...this.options
        });

        this.startButton = this.createButton(layout, 'Start', 1, () => this.options.onStart && this.options.onStart());
        this.pauseButton = this.createButton(layout, 'Pause', 3, () => this.options.onPause && this.options.onPause());
        this.stepButton = this.createButton(layout, 'Step', 5, () => this.options.onStep && this.options.onStep());
        this.clearButton = this.createButton(layout, 'Clear', 7, () => this.options.onClear && this.options.onClear());
        this.saveButton = this.createButton(layout, 'Save', 9, () => this.options.onSave && this.options.onSave());
        this.loadButton = this.createButton(layout, 'Load', 11, () => this.options.onLoad && this.options.onLoad());

        this.cpuLabel = blessed.text({
            parent: layout,
            content: 'CPU: 100%',
            top: 14,
            left: 2,
            height: 1
        });

        this.runStateLabel = blessed.text({
            parent: layout,
            content: 'State: PAUSED',
            top: 16,
            left: 2,
            height: 1,
            style: {
                fg: 'yellow'
            }
        });

        return layout;
    }

    createButton(parent, content, top, onPress) {
        const button = blessed.button({
            parent: parent,
            content: ` ${content} `,
            top,
            left: 'center',
            shrink: true,
            mouse: true,
            keys: true,
            style: {
                fg: 'white',
                bg: 'blue',
                focus: {
                    bg: 'red'
                }
            }
        });
        button.on('press', onPress);
        return button;
    }

    setCpu(percent) {
        this.cpuLabel.setContent(`CPU: ${percent}%`);
        this.render();
    }

    setRunState(isRunning) {
        if (isRunning) {
            this.runStateLabel.setContent('State: RUNNING');
            this.runStateLabel.style.fg = 'green';
        } else {
            this.runStateLabel.setContent('State: PAUSED');
            this.runStateLabel.style.fg = 'yellow';
        }
        this.render();
    }
}
