import blessed from 'neo-blessed';
import {Component} from './Component.js';

export class MenuPane extends Component {
    createWidget() {
        const widget = blessed.list({
            parent: this.screen, // this should be attached to the screen to be a modal
            label: this.options.label || 'Menu',
            items: (this.options.items || []).map(item => item.name),
            top: 'center',
            left: 'center',
            width: '50%',
            height: '50%',
            border: 'line',
            style: {
                selected: {
                    bg: 'blue'
                }
            },
            keys: true,
            vi: true,
            mouse: true,
            hidden: true,
            ...this.options
        });

        widget.on('select', (item, index) => {
            if (this.options.onSelect) {
                this.options.onSelect(this.options.items[index]);
            }
            this.toggle(); // auto-close on select
        });

        return widget;
    }

    setItems(items) {
        this.options.items = items;
        this.widget.setItems(items.map(item => item.name));
        this.render();
    }
}
