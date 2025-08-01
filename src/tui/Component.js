import blessed from 'neo-blessed';

/**
 * Base class for a TUI component.
 */
export class Component {
    /**
     * @param {blessed.Screen} screen - The main screen object.
     * @param {blessed.Element} parent - The parent element for this component.
     * @param {object} options - Configuration options for the blessed widget.
     */
    constructor(screen, parent, options = {}) {
        this.screen = screen;
        this.parent = parent;
        this.options = options;
        this.widget = this.createWidget();
    }

    /**
     * This method should be implemented by subclasses to create the specific blessed widget.
     * @returns {blessed.Element} The created blessed widget.
     */
    createWidget() {
        throw new Error("Component subclass must implement createWidget()");
    }

    /**
     * Renders the component's widget and the screen.
     */
    render() {
        this.screen.render();
    }

    /**
     * Hides the component's widget.
     */
    hide() {
        this.widget.hide();
        this.render();
    }

    /**
     * Shows the component's widget.
     */
    show() {
        this.widget.show();
        this.render();
    }

    /**
     * Toggles the visibility of the component's widget.
     */
    toggle() {
        this.widget.toggle();
        this.render();
    }

    /**
     * Sets focus on the component's widget.
     */
    focus() {
        this.widget.focus();
    }
}
