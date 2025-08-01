import blessed from 'neo-blessed';
import {Component} from './Component.js';

export class InputPane extends Component {
    createWidget() {
        const widget = blessed.textbox({
            parent: this.parent,
            bottom: 0,
            width: '100%',
            height: 1,
            inputOnFocus: true,
            style: {
                bg: 'blue'
            },
            ...this.options
        });

        widget.on('submit', (text) => {
            if (this.options.onCommand) {
                this.options.onCommand(text);
            }
            widget.clearValue();
            this.screen.render();
            widget.focus();
        });

        return widget;
    }
}
