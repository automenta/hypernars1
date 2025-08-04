# Revise the implementation, adding missing or helpful functionality.

## Hybridize Non-axiomatic Logic (NARS) & freeform local-learning recurrent networks

- Unify symbolic and subsymbolic approaches
- Structural (--\>, \<-\>, \*, etc...)
- Procedural (&&, \==\>, \<=\>, etc...), with temporal structure
- Attempt to eliminate reasoning overlap (ex: Stamps)
- Avoid relying on lossy representations (ex: embedding vectors)

- Feasible, implementable, and applicable
- Scalable
- Adhere to AIKR (assumption of insufficient knowledge resources) principles

- Write high-level algorithm, not code, remaining programming language and platform agnostic

- NARchy, the best NARS implementation:
    - https://narchy.org/
    - Source Code: https://github.com/narchy/narchy/tree/main/narchy
    - Derivation Rules: https://github.com/narchy/narchy/tree/main/narchy/nar/src/main/resources

* Ensure that the system is resilient to combinatorial explosion, fairly distributing CPU resources by priority.
* Explore how to decompose the control cycle into fine-grained operations, minimizing redundant computations and
  enabling memoization.
* Ensure that the system can simultaneously hold contradictory beliefs in the same concept, (like NARchy's belief
  tables).
* NARchy has a sophisticated Prolog-inspired expression
  evaluator [https://github.com/narchy/narchy/tree/main/narchy/nar/src/main/java/nars/eval](https://github.com/narchy/narchy/tree/main/narchy/nar/src/main/java/nars/eval)
* NARchy uses a simple priority-only budget; consider if this is sufficient.
* Consider NARchy's [Deriver](https://github.com/narchy/narchy/blob/main/narchy/nar/src/main/java/nars/Deriver.java) (
  default
  implementation: [TaskBagDeriver](https://github.com/narchy/narchy/blob/main/narchy/nar/src/main/java/nars/deriver/impl/TaskBagDeriver.java)),
  and the set of Premise classes whose execution comprises the Derivation process that ultimately results in
  more [Premise](https://github.com/narchy/narchy/tree/main/narchy/nar/src/main/java/nars/premise)'s, or NALTasks.

Consider:

* To address the design note—"Decentralized asynchronous control is parallelizable and simplest"—this revision shifts
  from a centralized synchronous cycle to a fully decentralized, asynchronous model. Each concept acts as an independent
  agent (e.g., akin to an actor in concurrent programming), processing its own local task queue asynchronously. This
  eliminates global synchronization, enabling natural parallelization (e.g., via threads or distributed nodes),
  simplifies control (no central coordinator; just local rules and message passing), and enhances scalability under AIKR
  by distributing resource allocation. Tasks propagate as messages between linked concepts, mimicking recurrent network
  dynamics while unifying symbolic NARS inference with subsymbolic local updates. Overlap elimination uses path hashing,
  avoiding stamp storage for efficiency (XOR-based for derivation tracking). Representations remain exact and symbolic,
  drawing directly from NARchy's components (e.g., bags for local queues, derivation rules for inference).
* Instead of discrete agents with local queues, use a unified hypergraph where nodes represent atomic terms, and
  hyperedges represent compound terms, statements, and relations. This elegance stems from treating all knowledge
  uniformly as hyperedges (n-ary connections with attributes), allowing seamless composition and decomposition without
  separate node types. Hypergraphs naturally handle NARS compounds (e.g., products as hyperedges linking multiple nodes)
  and enable efficient querying via adjacency indexing.
* Hybrid event-driven wavefront propagation. Events trigger localized "waves" of activation that spread recurrently
  through the hypergraph, damped by budgets and distances, with parallelizable local updates. This is simpler and more
  efficient than per-agent queues (reduces overhead), while remaining decentralized—no central loop, just reactive
  propagations. Waves handle temporal aspects by delayed firing, and learning occurs locally during propagation. Under
  AIKR, waves are bounded by resource limits, prioritizing high-utility paths.

# Revise, achieving functional completeness.

## Code Guidelines

- Elegance: abstraction, modularity, and syntax patterns (ex: ternary, switch, etc)
- No comments: rely purely on self-documenting code and meaningful identifiers
- Latest versions of JavaScript and dependencies

```javascript
[SOURCE CODE]
```