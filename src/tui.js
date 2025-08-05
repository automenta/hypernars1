import React from 'react';
import {render} from 'ink';
import {NAR} from './NAR.js';
import Tui from './tui/App.js';

const nar = new NAR();

render(React.createElement(Tui, {nar}));
