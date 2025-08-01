import blessed from 'neo-blessed';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { NARHyper } from './NARHyper.js';
import { LogPane } from './tui/LogPane.js';
import { InputPane } from './tui/InputPane.js';
import { StatusPane } from './tui/StatusPane.js';
import { ControlPane } from './tui/ControlPane.js';
import { DemoPane } from './tui/DemoPane.js';
import { ParameterPane } from './tui/ParameterPane.js';
import { MemoryPane } from './tui/MemoryPane.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class Tui {
  constructor() {
    this.nar = new NARHyper();
    this.isRunning = false;
    this.runInterval = null;
    this.cpuThrottle = 100;
    this.baseRunDelay = 0;
    this.demos = [];

    this.screen = blessed.screen({ smartCSR: true, title: 'HyperNARS IDE' });

    const leftPanel = blessed.layout({ parent: this.screen, width: '70%', height: '100%-2', left: 0, top: 0, layout: 'grid' });
    this.logPane = new LogPane(this.screen, leftPanel, { width: '100%', height: '60%' });
    this.memoryPane = new MemoryPane(this.screen, leftPanel, { width: '100%', height: '40%' });

    const rightPanel = blessed.layout({ parent: this.screen, width: '30%', height: '100%-2', right: 0, top: 0, layout: 'grid'});
    this.controlPane = new ControlPane(this.screen, rightPanel, {
      width: '100%', height: '34%',
       onStart: () => this.start(), onPause: () => this.pause(), onStep: () => this.step(), onClear: () => this.clear(),
       onSave: () => this.saveState(), onLoad: () => this.loadState(),
    });
    this.parameterPane = new ParameterPane(this.screen, rightPanel, {
      width: '100%', height: '33%',
      onParamChanged: (key, value) => this.logPane.log(`[Param] Set ${key} = ${value}`)
    });
    this.demoPane = new DemoPane(this.screen, rightPanel, {
      width: '100%', height: '33%',
      onRunDemo: (demo) => this.runDemo(demo)
    });

    this.inputPane = new InputPane(this.screen, this.screen, { onCommand: (cmd) => this.handleCommand(cmd) });
    this.statusPane = new StatusPane(this.screen, this.screen);

    this.parameterPane.setConfig(this.nar.config);
    this.setupGlobalKeys();
    this.setupEventListeners();

    this.loadDemos().then(() => { this.inputPane.focus(); this.screen.render(); });
    this.controlPane.setRunState(this.isRunning);
    setInterval(() => this.tick(), 1000);
  }

  tick() {
    this.updateStatusBar();
    this.memoryPane.update(this.nar);
  }

  showFileManager(title, callback) {
    const fm = blessed.filemanager({
      parent: this.screen, label: title, border: 'line', style: { selected: { bg: 'blue' } },
      height: 'half', width: 'half', top: 'center', left: 'center', cwd: process.cwd(),
      keys: true, vi: true, mouse: true, scrollable: true,
    });
    fm.on('file', (file) => {
      callback(null, path.join(fm.cwd, file));
      fm.destroy(); this.screen.render();
    });
    fm.on('cancel', () => {
      callback(new Error('Cancelled.'));
      fm.destroy(); this.screen.render();
    });
    fm.refresh(); fm.focus(); this.screen.render();
  }

  async saveState() {
    this.pause();
    this.showFileManager('Save State As...', async (err, filepath) => {
      if (err) { this.logPane.log('Save cancelled.'); return; }
      try {
        await fs.writeFile(filepath, this.nar.saveState());
        this.logPane.log(`State saved to ${filepath}`);
      } catch (e) { this.logPane.log(`Error saving state: ${e.message}`); }
    });
  }

  async loadState() {
    this.pause();
    this.showFileManager('Load State From...', async (err, filepath) => {
      if (err) { this.logPane.log('Load cancelled.'); return; }
      try {
        const stateJson = await fs.readFile(filepath, 'utf-8');
        this.nar.loadState(stateJson);
        this.parameterPane.setConfig(this.nar.config);
        this.setupEventListeners();
        this.tick(); // immediate update
        this.logPane.log(`State loaded from ${filepath}`);
      } catch (e) { this.logPane.log(`Error loading state: ${e.message}`); }
    });
  }

  async loadDemos() {
    try {
      const demoDir = path.join(__dirname, 'demos');
      const files = await fs.readdir(demoDir).then(f => f.filter(x => x.endsWith('.js')).sort());
      this.demos = await Promise.all(files.map(file => import(path.join(demoDir, file)).then(m => m.default)));
      this.demoPane.setDemos(this.demos);
    } catch (e) { this.logPane.log(`Error loading demos: ${e.message}`); }
  }

  runDemo(demo) {
    if (!demo) return;
    try {
      this.logPane.log(`\n--- Running Demo: ${demo.name} ---`);
      const result = demo.run(this.nar, (msg) => this.logPane.log(msg));
      if (result) this.logPane.log(result);
    } catch (e) { this.logPane.log(`Error in demo "${demo.name}": ${e.message}`); }
    this.tick();
  }

  setupGlobalKeys() {
    this.screen.key(['escape', 'q', 'C-c'], () => process.exit(0));
    this.screen.key(['f2'], () => this.parameterPane.focus());
    this.screen.key(['f3'], () => this.memoryPane.focus());
    this.screen.key(['tab'], () => {
      if (this.screen.focused === this.inputPane.widget) this.demoPane.focus();
      else if (this.screen.focused === this.demoPane.list) this.parameterPane.focus();
      else if (this.screen.focused === this.parameterPane.list) this.memoryPane.focus();
      else this.inputPane.focus();
    });
  }

  updateStatusBar() {
    const concepts = this.nar.state.hypergraph.size;
    const queue = this.nar.state.eventQueue.heap.length;
    const step = this.nar.state.currentStep;
    const statusText = `Concepts: ${concepts} | Queue: ${queue} | Step: ${step} | F2:Param F3:Mem Tab:Cycle`;
    this.statusPane.setContent(statusText);
  }

  setupEventListeners() {
    this.nar.removeAllListeners?.(); // a bit of a hack for now
    this.nar.on('belief-added', (data) => this.logPane.log(`[Belief] ${data.hyperedgeId.substring(0,20)} f:${data.truth.frequency.toFixed(2)} c:${data.truth.confidence.toFixed(2)}`));
    this.nar.on('contradiction-resolved', (data) => this.logPane.log(`[!] Contradiction for ${data.hyperedgeId.substring(0,20)}`));
    this.nar.on('focus-changed', (data) => this.logPane.log(`[*] Focus: ${data.newFocus.substring(0,20)}`));
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.controlPane.setRunState(true);
    this.logPane.log('== Reasoner Started ==');
    const stepFn = () => {
        if (!this.isRunning) return;
        this.nar.step();
        this.runInterval = (this.baseRunDelay > 0) ? setTimeout(stepFn, this.baseRunDelay) : setImmediate(stepFn);
    };
    stepFn();
  }

  pause() {
    if (!this.isRunning) return;
    this.isRunning = false;
    this.controlPane.setRunState(false);
    if(this.runInterval) { clearTimeout(this.runInterval); this.runInterval = null; }
    this.logPane.log('== Reasoner Paused ==');
  }

  step() {
    if(this.isRunning) this.pause();
    this.nar.step();
    this.logPane.log('-- Stepped --');
    this.tick();
  }

  clear() {
    this.pause();
    this.logPane.log('== Clearing Reasoner State ==');
    this.nar.clearState();
    this.setupEventListeners();
    this.parameterPane.setConfig(this.nar.config);
    this.tick();
  }

  setThrottle(percentage) {
    this.cpuThrottle = Math.max(1, Math.min(100, percentage));
    this.baseRunDelay = 1000 * (1 - (this.cpuThrottle / 100));
    this.controlPane.setCpu(this.cpuThrottle);
    this.logPane.log(`CPU throttle set to ${this.cpuThrottle}% (delay: ${this.baseRunDelay.toFixed(0)}ms)`);
    if (this.isRunning) { this.pause(); this.start(); }
  }

  handleCommand(command) {
    if (command.startsWith('/')) {
        const [cmd, ...args] = command.substring(1).split(' ');
        switch (cmd) {
            case 'quit': return process.exit(0);
            case 'run': this.nar.run(parseInt(args[0], 10) || 1); break;
            case 'ask': this.nar.ask(args.join(' ')).then(a => this.logPane.log(`Answer: ${JSON.stringify(a)}`)).catch(e => this.logPane.log(`Error: ${e.message}`)); break;
            case 'throttle': this.setThrottle(parseInt(args[0], 10) || 100); break;
            default: this.logPane.log(`Unknown command: ${command}`);
        }
    } else {
        try {
            this.logPane.log(`Added belief: ${this.nar.nal(command)}`);
        } catch (e) {
            this.logPane.log(`Error: ${e.message}`);
        }
    }
    this.tick();
  }
}

const tui = new Tui();
