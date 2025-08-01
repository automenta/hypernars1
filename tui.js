import blessed from 'neo-blessed';
import { NARHyper } from './src/NARHyper.js';

class Tui {
  constructor() {
    this.nar = new NARHyper();
    this.setupEventListeners();

    this.screen = blessed.screen({
      smartCSR: true,
      title: 'HyperNARS TUI'
    });

    // Main layout
    this.grid = new blessed.layout({
      parent: this.screen,
      width: '100%',
      height: '100%'
    });

    // Output log
    this.logOutput = blessed.log({
      parent: this.grid,
      width: '100%',
      height: '95%',
      border: 'line',
      label: 'Log',
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: ' ',
        inverse: true
      },
      keys: true,
      vi: true,
      mouse: true
    });

    // Input box
    this.inputBox = blessed.textbox({
      parent: this.grid,
      bottom: 0,
      width: '100%',
      height: 1,
      inputOnFocus: true,
      style: {
        bg: 'blue'
      }
    });

    // Status bar
    this.statusBar = blessed.box({
        parent: this.grid,
        bottom: 1,
        width: '100%',
        height: 1,
        style: {
            bg: 'gray'
        }
    });

    // Event handling
    this.screen.key(['escape', 'q', 'C-c'], () => process.exit(0));
    this.inputBox.on('submit', (text) => this.handleCommand(text));
    this.screen.key(['f1'], () => this.toggleMenu());

    // Menu
    this.menuItems = [
      { name: 'Run All Demos', action: () => this.runAllDemos() },
      { name: 'Demo 1: Basic Inference', action: () => this.runDemo1() },
      { name: 'Demo 2: Contradiction', action: () => this.runDemo2() },
      { name: 'Demo 3: Temporal Reasoning', action: () => this.runDemo3() },
      { name: 'Demo 4: Meta-Reasoning', action: () => this.runDemo4() },
      { name: 'Demo 5: Explanation', action: () => this.runDemo5() },
    ];

    this.menu = blessed.list({
      parent: this.screen,
      label: 'Demos & Tests (F1 to close)',
      items: this.menuItems.map(item => item.name),
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
      hidden: true
    });

    this.menu.on('select', (item, index) => {
        this.menuItems[index].action();
        this.toggleMenu();
    });

    this.inputBox.focus();
    this.screen.render();

    this.updateStatusBar();
    setInterval(() => this.updateStatusBar(), 1000);
  }

  updateStatusBar() {
    const concepts = this.nar.state.hypergraph.size;
    const queue = this.nar.state.eventQueue.heap.length;
    const step = this.nar.state.currentStep;
    const focus = this.nar.metaReasoner.currentFocus;

    const statusText = `Concepts: ${concepts} | Event Queue: ${queue} | Step: ${step} | Focus: ${focus} | (F1 for Menu)`;
    this.statusBar.setContent(statusText);
    this.screen.render();
  }

  toggleMenu() {
    this.menu.toggle();
    if (!this.menu.hidden) {
      this.menu.focus();
    } else {
      this.inputBox.focus();
    }
    this.screen.render();
  }

  setupEventListeners() {
    this.nar.on('belief-added', (data) => {
        this.logOutput.log(`[Belief Added] ${data.hyperedgeId} - f:${data.truth.frequency.toFixed(2)} c:${data.truth.confidence.toFixed(2)}`);
        this.screen.render();
    });
    this.nar.on('contradiction-resolved', (data) => {
        this.logOutput.log(`\n[!] Contradiction Resolved for ${data.hyperedgeId} via ${data.strategy}`);
        this.screen.render();
    });
    this.nar.on('focus-changed', (data) => {
        this.logOutput.log(`\n[*] Meta-Reasoner changed focus to: ${data.newFocus}`);
        this.screen.render();
    });
  }

  runAllDemos() {
    this.logOutput.log('--- Running all demos ---');
    this.runDemo1();
    this.runDemo2();
    this.runDemo3();
    this.runDemo4();
    this.runDemo5();
    this.updateStatusBar();
  }

  runDemo1() {
    this.logOutput.log("\n===== 1. ADVANCED NAL PARSING & BASIC INFERENCE =====");
    this.nar.nal('<(bird * animal) --> flyer>. %0.9;0.8%');
    this.nar.nal('<penguin --> (bird * !flyer)>. #0.95#');
    this.nar.nal('<tweety --> bird>.');
    this.logOutput.log("Initial beliefs added.");
    this.nar.run(50);
    const tweetyIsAnimalId = this.nar.inheritance('tweety', 'animal');
    const tweetyIsFlyerId = this.nar.inheritance('tweety', 'flyer');
    this.logOutput.log(`Belief that Tweety is an animal: ${this.nar.getBeliefs(tweetyIsAnimalId)[0]?.truth.expectation().toFixed(3)}`);
    this.logOutput.log(`Belief that Tweety is a flyer: ${this.nar.getBeliefs(tweetyIsFlyerId)[0]?.truth.expectation().toFixed(3)}`);
  }

  runDemo2() {
    this.logOutput.log("\n===== 2. CONTRADICTION & RESOLUTION =====");
    this.logOutput.log("\nIntroducing belief that Tweety is a penguin...");
    this.nar.nal('<tweety --> penguin>. %0.99;0.99%');
    this.nar.run(100);
    const tweetyIsFlyerId = this.nar.inheritance('tweety', 'flyer');
    this.logOutput.log(`\nNew belief that Tweety is a flyer: ${this.nar.getBeliefs(tweetyIsFlyerId)[0]?.truth.expectation().toFixed(3)}`);
  }

  runDemo3() {
    this.logOutput.log("\n===== 3. TEMPORAL REASONING =====");
    const morning = this.nar.temporalManager.interval('daytime_event', Date.now(), Date.now() + 4 * 3600 * 1000);
    const meeting = this.nar.temporalManager.interval('important_meeting', Date.now() + 1 * 3600 * 1000, Date.now() + 2 * 3600 * 1000);
    const relId = this.nar.temporalManager.temporalRelation(meeting, morning, 'during', { truth: this.nar.truth(1, 0.9) });
    this.logOutput.log("Established that the meeting happens during the day.");
  }

  runDemo4() {
    this.logOutput.log("\n===== 4. META-REASONING & ADAPTATION =====");
    this.logOutput.log(`Current resource policy (budgetThreshold): ${this.nar.config.budgetThreshold.toFixed(4)}`);
    this.nar.ask('<tweety --> ?x>?').catch(e => {});
    this.nar.ask('<penguin --> ?x>?').catch(e => {});
    this.nar.run(120);
    this.logOutput.log(`New resource policy (budgetThreshold): ${this.nar.config.budgetThreshold.toFixed(4)}`);
  }

  runDemo5() {
    this.logOutput.log("\n===== 5. FINAL EXPLANATION DEMO =====");
    const tweetyIsAnimalId = this.nar.inheritance('tweety', 'animal');
    this.logOutput.log("\n--- Final Story about why Tweety is an animal ---");
    this.logOutput.log(this.nar.explain(tweetyIsAnimalId, { format: 'story' }));
  }

  handleCommand(command) {
    if (command.startsWith('/')) {
        const [cmd, ...args] = command.substring(1).split(' ');
        switch (cmd) {
            case 'quit':
                return process.exit(0);
            case 'run':
                const steps = args[0] ? parseInt(args[0], 10) : 1;
                this.logOutput.log(`Running ${steps} steps...`);
                this.nar.run(steps);
                this.updateStatusBar();
                break;
            case 'ask':
                this.nar.ask(args.join(' ')).then(answer => {
                    this.logOutput.log(`Answer: ${JSON.stringify(answer)}`);
                }).catch(err => {
                    this.logOutput.log(`Error: ${err.message}`);
                });
                break;
            case 'explain':
                const explanation = this.nar.explain(args[0]);
                this.logOutput.log(explanation);
                break;
            default:
                this.logOutput.log(`Unknown command: ${command}`);
        }
    } else {
        try {
            const result = this.nar.nal(command);
            this.logOutput.log(`Added belief: ${result}`);
        } catch (e) {
            this.logOutput.log(`Error: ${e.message}`);
        }
    }

    this.updateStatusBar();
    this.inputBox.clearValue();
    this.screen.render();
    this.inputBox.focus();
  }
}

const tui = new Tui();
