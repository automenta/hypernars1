import React from 'react';
import {render} from 'ink';
import {NARHyper} from './NARHyper.js';
import Tui from './tui/App.js';

const nar = new NARHyper();

render(React.createElement(Tui, {nar}));
