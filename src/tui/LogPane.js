import blessed from 'neo-blessed';
import {Component} from './Component.js';

export class LogPane extends Component {
    createWidget() {
        return blessed.log({
            parent: this.parent,
            label: 'Log',
            width: '70%',
            height: '90%',
            left: 0,
            top: 0,
            border: 'line',
            scrollable: true,
            alwaysScroll: true,
            scrollbar: {
                ch: ' ',
                inverse: true
            },
            keys: true,
            vi: true,
            mouse: true,
            ...this.options
        });
    }

    log(message) {
        this.widget.log(message);
    }
}
