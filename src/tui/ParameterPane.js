import blessed from 'neo-blessed';
import { Component } from './Component.js';

export class ParameterPane extends Component {
    createWidget() {
        const layout = blessed.layout({
            parent: this.parent,
            label: 'Parameters (F2)',
            border: 'line',
            style: { border: { fg: 'cyan' } },
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
            }
        });

        this.list.on('select', (item, index) => {
            this.editParameter(this.options.config, item.getContent());
        });

        return layout;
    }

    setConfig(config) {
        this.options.config = config;
        this.updateList();
    }

    updateList() {
        if (!this.options.config) return;
        const items = Object.entries(this.options.config).map(([key, value]) => {
            const displayValue = typeof value === 'number' ? value.toPrecision(3) : value;
            return `${key}: ${displayValue}`;
        });
        this.list.setItems(items);
        this.render();
    }

    editParameter(config, selectedItem) {
        const key = selectedItem.split(':')[0];
        const originalValue = config[key];

        const prompt = blessed.prompt({
            parent: this.screen,
            top: 'center',
            left: 'center',
            height: 'shrink',
            width: 'half',
            border: 'line',
            label: `Set value for ${key}`
        });

        prompt.input(`Enter new value for ${key} (current: ${originalValue}):`, '', (err, value) => {
            // Re-render to hide prompt and re-focus our list
            this.render();
            this.focus();

            if (err || value === null || value === '') {
                return;
            }

            try {
                let newValue;
                const originalType = typeof originalValue;

                if (originalType === 'number') {
                    newValue = parseFloat(value);
                    if (isNaN(newValue)) throw new Error('Invalid number');
                } else if (originalType === 'boolean') {
                    if (value.toLowerCase() === 'true' || value === '1') newValue = true;
                    else if (value.toLowerCase() === 'false' || value === '0') newValue = false;
                    else throw new Error('Invalid boolean (must be true or false)');
                } else {
                    newValue = value;
                }

                config[key] = newValue;
                this.updateList();

                if (this.options.onParamChanged) {
                    this.options.onParamChanged(key, newValue);
                }

            } catch (e) {
                // For now, we just ignore bad input. A proper modal could be shown.
            }
        });
    }

    focus() {
        this.list.focus();
    }
}
