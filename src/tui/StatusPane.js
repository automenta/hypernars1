import blessed from 'neo-blessed';
import {Component} from './Component.js';

export class StatusPane extends Component {
    createWidget() {
        return blessed.box({
            parent: this.parent,
            bottom: 1,
            width: '100%',
            height: 1,
            style: {
                bg: 'gray'
            },
            ...this.options
        });
    }

    setContent(text) {
        this.widget.setContent(text);
        this.render();
    }
}
