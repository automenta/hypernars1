# Proposed User Interface Enhancements for NARHyper

## 1. Visual Knowledge Graph Explorer

A dynamic visualization of the hypergraph knowledge base would transform how users interact with NARHyper, making
abstract reasoning processes tangible.

```
function createKnowledgeGraphExplorer(nar) {
    // Initialize canvas with physics-based layout
    const graph = new HypergraphVisualization({
        container: '#knowledge-graph-container',
        physics: {
            repulsion: 2000,
            gravity: -1.2,
            springLength: 100
        },
        nodeStyles: {
            'Term': { shape: 'circle', size: 25, color: '#4287f5' },
            'Inheritance': { shape: 'diamond', size: 30, color: '#4caf50' },
            'Implication': { shape: 'square', size: 28, color: '#ff9800' },
            'Temporal': { shape: 'triangle', size: 27, color: '#9c27b0' }
        }
    });
    
    // Real-time updates as knowledge changes
    nar.on('belief-added', (data) => {
        graph.addNode(data.hyperedgeId, {
            type: getHyperedgeType(data.hyperedgeId),
            truth: data.expectation,
            label: formatHyperedgeLabel(data.hyperedgeId)
        });
    });
    
    nar.on('step', (data) => {
        if (data.event.derivationPath.length > 0) {
            graph.highlightPath(data.event.derivationPath);
            graph.animateTruthFlow(data.event.target, data.activation);
        }
    });
    
    // Interactive features
    graph.on('node-click', (nodeId) => {
        showNodeDetailsPanel(nar, nodeId);
        if (isQuestion(nodeId)) {
            nar.nalq(extractQuestionPattern(nodeId));
        }
    });
    
    graph.on('node-drag', (nodeId, position) => {
        nar.updateSpatialPosition(nodeId, position);
    });
    
    // Filter controls
    setupFilterControls({
        minExpectation: 0.3,
        showTemporal: true,
        showContradictions: true,
        onFilterChange: (filters) => {
            graph.filterNodes(filters);
        }
    });
    
    return graph;
}
```

**Key Benefits:**

- Visual identification of knowledge gaps and dense reasoning pathways
- Intuitive understanding of hypergraph structure (nodes as atomic terms, hyperedges as relationships)
- Immediate recognition of high-confidence vs. uncertain beliefs through color intensity
- Ability to see how activation propagates through the network during reasoning

## 2. Interactive Reasoning Workbench

A dedicated environment for constructing and testing reasoning scenarios would significantly improve usability.

```
function createReasoningWorkbench(nar) {
    // Layout with three main panels
    const workbench = new SplitPanelLayout({
        panels: [
            { id: 'input', size: 30, component: createInputPanel() },
            { id: 'reasoning', size: 40, component: createReasoningPanel() },
            { id: 'output', size: 30, component: createOutputPanel() }
        ]
    });
    
    // Input panel - NAL statement composer
    function createInputPanel() {
        return {
            render: () => `
                <div class="nal-composer">
                    <div class="statement-builder">
                        <select id="statement-type">
                            <option value="inheritance">Inheritance (-->)</option>
                            <option value="implication">Implication (==>)</option>
                            <option value="similarity"><-></option>
                            <option value="conjunction">Conjunction (&&)</option>
                        </select>
                        
                        <div class="operands">
                            <input type="text" id="operand1" placeholder="Subject">
                            <input type="text" id="operand2" placeholder="Predicate">
                        </div>
                        
                        <div class="truth-values">
                            <label>Frequency: <input type="range" min="0" max="1" step="0.01" value="0.8"></label>
                            <label>Confidence: <input type="range" min="0" max="1" step="0.01" value="0.75"></label>
                        </div>
                    </div>
                    
                    <button id="add-statement">Add Statement</button>
                    <button id="ask-question">Ask Question</button>
                </div>
            `,
            
            setupEvents: () => {
                $('#add-statement').click(() => {
                    const type = $('#statement-type').val();
                    const op1 = $('#operand1').val();
                    const op2 = $('#operand2').val();
                    const freq = $('#frequency').val();
                    const conf = $('#confidence').val();
                    
                    const statement = buildNALStatement(type, op1, op2, freq, conf);
                    nar.nal(statement);
                    updateReasoningPanel();
                });
                
                $('#ask-question').click(() => {
                    const type = $('#statement-type').val();
                    const op1 = $('#operand1').val();
                    const op2 = $('#operand2').val();
                    
                    const question = buildNALQuestion(type, op1, op2);
                    nar.nalq(question).then(answer => {
                        displayAnswer(answer);
                    });
                });
            }
        };
    }
    
    // Reasoning panel - Live inference visualization
    function createReasoningPanel() {
        return {
            render: () => `
                <div class="reasoning-visualization">
                    <div class="inference-path"></div>
                    <div class="activation-meter">
                        <div class="activation-level" style="width: 0%"></div>
                    </div>
                    <div class="derivation-rules">
                        <h4>Active Derivation Rules:</h4>
                        <ul id="active-rules"></ul>
                    </div>
                </div>
            `,
            
            update: (inferenceData) => {
                // Update visualization based on current inference state
                updateInferencePath(inferenceData.path);
                updateActivationMeter(inferenceData.activation);
                updateActiveRules(inferenceData.activeRules);
            }
        };
    }
    
    // Output panel - Results and explanations
    function createOutputPanel() {
        return {
            render: () => `
                <div class="results-display">
                    <div class="tabs">
                        <button data-tab="answers">Answers</button>
                        <button data-tab="explanations">Explanations</button>
                        <button data-tab="belief-table">Belief Table</button>
                    </div>
                    
                    <div id="answers-content" class="tab-content active">
                        <!-- Answers will be displayed here -->
                    </div>
                    
                    <div id="explanations-content" class="tab-content">
                        <!-- Explanations will be displayed here -->
                    </div>
                    
                    <div id="belief-table-content" class="tab-content">
                        <!-- Belief table will be displayed here -->
                    </div>
                </div>
            `,
            
            displayAnswer: (answer) => {
                $('#answers-content').html(renderAnswer(answer));
            },
            
            displayExplanation: (explanation) => {
                $('#explanations-content').html(renderExplanation(explanation));
            },
            
            displayBeliefTable: (tableData) => {
                $('#belief-table-content').html(renderBeliefTable(tableData));
            }
        };
    }
    
    // Set up two-way communication between panels
    workbench.on('statement-added', (statement) => {
        updateReasoningPanel();
    });
    
    workbench.on('question-asked', (question) => {
        showActiveReasoning(question);
    });
    
    return workbench;
}
```

**Key Benefits:**

- Guided construction of NAL statements without requiring syntax expertise
- Real-time visualization of the reasoning process as it happens
- Immediate feedback on statement validity and confidence levels
- Tabbed interface for exploring different aspects of the reasoning results

## 3. Belief Conflict Resolution Interface

NARHyper's ability to maintain contradictory beliefs is powerful but challenging to manage without proper UI support.

```
function createConflictResolutionInterface(nar) {
    const interface = {
        container: '#conflict-resolution-container',
        
        init: () => {
            this.render();
            this.setupEventListeners();
            this.startMonitoringConflicts();
        },
        
        render: () => {
            $(this.container).html(`
                <div class="conflict-manager">
                    <h3>Belief Conflicts</h3>
                    <div class="conflict-filters">
                        <select id="conflict-severity">
                            <option value="all">All Conflicts</option>
                            <option value="high" selected>High Severity</option>
                            <option value="medium">Medium Severity</option>
                            <option value="low">Low Severity</option>
                        </select>
                        <button id="resolve-all">Resolve All</button>
                    </div>
                    
                    <div id="conflict-list" class="conflict-list">
                        <!-- Conflicts will be populated here -->
                    </div>
                    
                    <div id="conflict-details" class="conflict-details hidden">
                        <div class="conflict-header">
                            <h4>Conflict Details</h4>
                            <button class="close-button">✖</button>
                        </div>
                        
                        <div class="conflict-comparison">
                            <div class="belief-column positive">
                                <h5>Supporting Evidence</h5>
                                <div class="evidence-list" id="supporting-evidence"></div>
                                <div class="belief-summary">
                                    <div class="truth-meter">
                                        <div class="frequency" style="width: 75%"></div>
                                        <div class="confidence" style="width: 65%"></div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="belief-column negative">
                                <h5>Contradicting Evidence</h5>
                                <div class="evidence-list" id="contradicting-evidence"></div>
                                <div class="belief-summary">
                                    <div class="truth-meter">
                                        <div class="frequency" style="width: 60%"></div>
                                        <div class="confidence" style="width: 50%"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="resolution-options">
                            <h5>Resolution Options</h5>
                            <div class="options-grid">
                                <button class="resolution-option" data-action="prioritize-supporting">
                                    Prioritize supporting evidence
                                </button>
                                <button class="resolution-option" data-action="prioritize-contradicting">
                                    Prioritize contradicting evidence
                                </button>
                                <button class="resolution-option" data-action="merge">
                                    Merge beliefs with weighted revision
                                </button>
                                <button class="resolution-option" data-action="temporal">
                                    Apply temporal decay to older belief
                                </button>
                                <button class="resolution-option" data-action="contextual">
                                    Create context-specific beliefs
                                </button>
                                <button class="resolution-option" data-action="defer">
                                    Defer resolution (maintain contradiction)
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `);
        },
        
        setupEventListeners: () => {
            $('#conflict-severity').change(() => this.refreshConflictList());
            
            $('#resolve-all').click(() => {
                const conflicts = this.getDisplayedConflicts();
                conflicts.forEach(conflict => this.autoResolveConflict(conflict));
            });
            
            $('.close-button').click(() => {
                $('#conflict-details').addClass('hidden');
            });
            
            $('.resolution-option').click(function() {
                const action = $(this).data('action');
                const conflictId = $('#conflict-details').data('conflict-id');
                interface.resolveConflict(conflictId, action);
            });
        },
        
        startMonitoringConflicts: () => {
            // Monitor for new belief additions that might create conflicts
            nar.on('belief-added', (data) => {
                const conflicts = this.detectConflictsForHyperedge(data.hyperedgeId);
                if (conflicts.length > 0) {
                    this.displayNewConflicts(conflicts);
                }
            });
            
            // Periodically check for emerging conflicts
            setInterval(() => {
                const conflicts = this.scanForConflicts();
                this.displayNewConflicts(conflicts);
            }, 5000);
        },
        
        detectConflictsForHyperedge: (hyperedgeId) => {
            const hyperedge = nar.hypergraph.get(hyperedgeId);
            if (!hyperedge) return [];
            
            // Check for contradictions with similar hyperedges
            const conflicts = [];
            const oppositeType = getOppositeType(hyperedge.type);
            
            // Check for direct contradictions
            nar.index.byType.get(oppositeType)?.forEach(id => {
                const opposite = nar.hypergraph.get(id);
                if (opposite && isContradictory(hyperedge, opposite)) {
                    conflicts.push(createConflictRecord(hyperedge, opposite));
                }
            });
            
            // Check for indirect contradictions through inference
            const derivedOpposites = nar.getDerivableContradictions(hyperedge);
            derivedOpposites.forEach(opposite => {
                conflicts.push(createConflictRecord(hyperedge, opposite, 'derived'));
            });
            
            return conflicts;
        },
        
        displayNewConflicts: (conflicts) => {
            conflicts.forEach(conflict => {
                this.addConflictToList(conflict);
                if ($('#conflict-details').hasClass('hidden')) {
                    this.showConflictDetails(conflict.id);
                }
            });
        },
        
        addConflictToList: (conflict) => {
            const severityClass = getSeverityClass(conflict.severity);
            const listItem = `
                <div class="conflict-item ${severityClass}" data-conflict-id="${conflict.id}">
                    <div class="conflict-summary">
                        <span class="conflict-severity">${conflict.severityLabel}</span>
                        <span class="conflict-statement">${formatConflictStatement(conflict)}</span>
                        <span class="conflict-evidence">${conflict.supportingCount} vs ${conflict.contradictingCount} pieces of evidence</span>
                    </div>
                </div>
            `;
            
            $('#conflict-list').prepend(listItem);
            
            $(`.conflict-item[data-conflict-id="${conflict.id}"]`).click(() => {
                this.showConflictDetails(conflict.id);
            });
        },
        
        showConflictDetails: (conflictId) => {
            const conflict = getConflictById(conflictId);
            if (!conflict) return;
            
            // Populate supporting evidence
            $('#supporting-evidence').html(renderEvidenceList(conflict.supportingEvidence));
            
            // Populate contradicting evidence
            $('#contradicting-evidence').html(renderEvidenceList(conflict.contradingEvidence));
            
            // Update truth meters
            updateTruthMeter('#supporting .frequency', conflict.supportingFrequency);
            updateTruthMeter('#supporting .confidence', conflict.supportingConfidence);
            updateTruthMeter('#contradicting .frequency', conflict.contradingFrequency);
            updateTruthMeter('#contradicting .confidence', conflict.contradingConfidence);
            
            // Show and store conflict ID
            $('#conflict-details')
                .data('conflict-id', conflictId)
                .removeClass('hidden');
        },
        
        resolveConflict: (conflictId, resolutionType) => {
            const conflict = getConflictById(conflictId);
            let resolutionResult;
            
            switch(resolutionType) {
                case 'prioritize-supporting':
                    resolutionResult = nar.resolveConflict(conflict, {
                        method: 'priority',
                        favor: 'supporting'
                    });
                    break;
                    
                case 'prioritize-contradicting':
                    resolutionResult = nar.resolveConflict(conflict, {
                        method: 'priority',
                        favor: 'contradicting'
                    });
                    break;
                    
                case 'merge':
                    resolutionResult = nar.resolveConflict(conflict, {
                        method: 'revision',
                        weight: conflict.supportingConfidence / 
                               (conflict.supportingConfidence + conflict.contradingConfidence)
                    });
                    break;
                    
                case 'temporal':
                    resolutionResult = nar.resolveConflict(conflict, {
                        method: 'temporal',
                        decayRate: 0.1
                    });
                    break;
                    
                case 'contextual':
                    resolutionResult = nar.resolveConflict(conflict, {
                        method: 'contextual',
                        contextTerms: identifyContextTerms(conflict)
                    });
                    break;
                    
                case 'defer':
                    // Just acknowledge but maintain contradiction
                    resolutionResult = { status: 'deferred' };
                    break;
            }
            
            // Update UI based on resolution
            this.updateAfterResolution(conflictId, resolutionResult);
        }
    };
    
    return interface;
}
```

**Key Benefits:**

- Clear visualization of contradictory beliefs and their supporting evidence
- Context-aware resolution strategies tailored to different conflict types
- Quantitative assessment of evidence strength for each position
- Options to either resolve conflicts or deliberately maintain contradictions
- Historical tracking of how conflicts evolved and were addressed

## 4. Natural Language Interface with Explanation Generation

```
function createNaturalLanguageInterface(nar) {
    return {
        // Translate natural language to NAL
        toNAL: (naturalText) => {
            // Use pattern matching and semantic analysis
            const patterns = [
                { 
                    regex: /(.+) is (?:a|an|a type of) (.+)/, 
                    template: '<$1 --> $2>.'
                },
                {
                    regex: /if (.+) then (.+)/,
                    template: '<$1 ==> $2>.'
                },
                {
                    regex: /(.+) and (.+) implies (.+)/,
                    template: '<($1 && $2) ==> $3>.'
                },
                {
                    regex: /(.+) means (.+)/,
                    template: '<$1 <=> $2>.'
                },
                {
                    regex: /(.+) happens after (.+)/,
                    template: 'after($2, $1).'
                }
            ];
            
            for (const pattern of patterns) {
                const match = naturalText.match(pattern.regex);
                if (match) {
                    let nal = pattern.template;
                    for (let i = 1; i < match.length; i++) {
                        nal = nal.replace(`$${i}`, match[i].trim());
                    }
                    return nal;
                }
            }
            
            // Fallback to question detection
            if (naturalText.endsWith('?')) {
                return this.toQuestion(naturalText.slice(0, -1));
            }
            
            return naturalText; // Return as-is if no pattern matches
        },
        
        // Translate NAL to natural language
        toNaturalLanguage: (nalStatement) => {
            // Handle different NAL statement types
            if (nalStatement.includes('-->') && nalStatement.includes('<') && nalStatement.includes('>')) {
                const [subject, predicate] = extractInheritanceTerms(nalStatement);
                return `${subject} is a ${predicate}.`;
            }
            
            if (nalStatement.includes('==>')) {
                const [premise, conclusion] = extractImplicationTerms(nalStatement);
                return `If ${premise}, then ${conclusion}.`;
            }
            
            if (nalStatement.includes('<->')) {
                const [term1, term2] = extractSimilarityTerms(nalStatement);
                return `${term1} is similar to ${term2}.`;
            }
            
            if (nalStatement.includes('&&')) {
                const terms = extractConjunctionTerms(nalStatement);
                return `${terms.slice(0, -1).join(', ')} and ${terms[terms.length-1]} are all true.`;
            }
            
            // Handle truth values
            const truthMatch = nalStatement.match(/%([\d.]+);([\d.]+)%/);
            if (truthMatch) {
                const frequency = parseFloat(truthMatch[1]);
                const confidence = parseFloat(truthMatch[2]);
                return `${nalStatement.replace(/%.*%/, '')} (${this.explainConfidence(frequency, confidence)})`;
            }
            
            return nalStatement;
        },
        
        explainConfidence: (frequency, confidence) => {
            const expectation = frequency * confidence / (confidence + (1 - confidence));
            
            if (expectation > 0.8) return "This is almost certainly true";
            if (expectation > 0.6) return "This is likely true";
            if (expectation > 0.4) return "This might be true";
            if (expectation > 0.2) return "This is unlikely to be true";
            return "This is almost certainly false";
        },
        
        generateExplanation: (hyperedgeId, depth = 3) => {
            const explanation = [];
            const hyperedge = nar.hypergraph.get(hyperedgeId);
            
            if (!hyperedge) return "I don't have information about that.";
            
            // Start with the main statement
            explanation.push(`I believe that ${this.toNaturalLanguage(hyperedgeId)} ` +
                            `${this.explainConfidence(hyperedge.getTruth().frequency, 
                                                    hyperedge.getTruth().confidence)}.`);
            
            // Add derivation path
            const derivationPath = nar.explain(hyperedgeId, depth);
            if (derivationPath && derivationPath.trim() !== '') {
                explanation.push("This belief is based on:");
                
                const steps = derivationPath.split('\n')
                    .filter(step => step.trim() !== '')
                    .slice(1); // Skip the first line which is the conclusion
                
                steps.forEach((step, i) => {
                    const indentLevel = (step.match(/^ */)[0].length / 2);
                    const ruleName = step.match(/[a-z_]+/)[0];
                    const ruleExplanation = this.explainDerivationRule(ruleName);
                    
                    explanation.push(`${'  '.repeat(indentLevel + 1)}- ${ruleExplanation}`);
                });
            }
            
            // Add belief table context if there are contradictions
            const beliefTable = nar.beliefTable(hyperedgeId);
            if (beliefTable.length > 1) {
                const strongest = beliefTable[0];
                const weakest = beliefTable[beliefTable.length - 1];
                
                if (Math.abs(strongest.expectation - weakest.expectation) > 0.3) {
                    explanation.push("There are conflicting perspectives on this:");
                    explanation.push(`- The strongest view has ${Math.round(strongest.expectation * 100)}% expectation`);
                    explanation.push(`- The weakest view has ${Math.round(weakest.expectation * 100)}% expectation`);
                    explanation.push("I'm prioritizing the strongest evidence in my conclusion.");
                }
            }
            
            return explanation.join('\n');
        },
        
        explainDerivationRule: (ruleName) => {
            const explanations = {
                'transitivity': 'transitive reasoning from multiple inheritance relationships',
                'induction': 'inductive reasoning from shared properties',
                'abduction': 'abductive reasoning to infer likely causes',
                'analogy': 'analogical reasoning based on similarity',
                'modus_ponens': 'direct application of a rule with known premise',
                'revision': 'integration of multiple sources of evidence',
                'property_derivation': 'derivation of properties from category membership'
            };
            
            return explanations[ruleName] || ruleName.replace(/_/g, ' ');
        },
        
        setupChatInterface: (containerId) => {
            $(containerId).html(`
                <div class="nli-container">
                    <div class="chat-history" id="chat-history"></div>
                    <div class="input-area">
                        <input type="text" id="user-input" placeholder="Ask me anything...">
                        <button id="send-button">Send</button>
                    </div>
                </div>
            `);
            
            $('#send-button').click(() => this.processUserInput());
            $('#user-input').keypress((e) => {
                if (e.key === 'Enter') this.processUserInput();
            });
        },
        
        processUserInput: () => {
            const userInput = $('#user-input').val().trim();
            if (userInput === '') return;
            
            // Add user message to chat
            this.addChatMessage('user', userInput);
            $('#user-input').val('');
            
            // Process input
            try {
                // First try as question
                if (userInput.endsWith('?')) {
                    const nalQuestion = this.toNAL(userInput);
                    this.addChatMessage('system', 'Let me think about that...');
                    
                    nar.nalq(nalQuestion).then(answer => {
                        const naturalAnswer = this.toNaturalLanguage(
                            `${answer.type}(${answer.args.join(',')})`
                        );
                        const explanation = this.generateExplanation(
                            `${answer.type}(${answer.args.join(',')})`
                        );
                        
                        this.addChatMessage('system', 
                            `Based on what I know: ${naturalAnswer}\n\n${explanation}`);
                    }).catch(error => {
                        this.addChatMessage('system', 
                            `I couldn't find a definitive answer. ${error.message}`);
                    });
                } 
                // Otherwise treat as statement
                else {
                    const nalStatement = this.toNAL(userInput);
                    nar.nal(nalStatement);
                    
                    // Generate confirmation
                    const confirmation = this.generateStatementConfirmation(nalStatement);
                    this.addChatMessage('system', confirmation);
                    
                    // Optionally ask follow-up question
                    if (Math.random() > 0.7) { // 30% chance of follow-up
                        const followUp = this.generateFollowUpQuestion(nalStatement);
                        this.addChatMessage('system', followUp);
                    }
                }
            } catch (error) {
                this.addChatMessage('system', 
                    `I had trouble understanding that: ${error.message}`);
            }
        },
        
        addChatMessage: (role, content) => {
            const className = role === 'user' ? 'user-message' : 'system-message';
            const avatar = role === 'user' ? '👤' : '🤖';
            
            const messageHtml = `
                <div class="chat-message ${className}">
                    <div class="avatar">${avatar}</div>
                    <div class="message-content">${content.replace(/\n/g, '<br>')}</div>
                </div>
            `;
            
            $('#chat-history').append(messageHtml);
            $('#chat-history').scrollTop($('#chat-history')[0].scrollHeight);
        },
        
        generateStatementConfirmation: (nalStatement) => {
            const natural = this.toNaturalLanguage(nalStatement);
            const truth = extractTruthValue(nalStatement);
            
            if (truth) {
                return `Okay, I've noted that "${natural}" ` +
                       `with ${Math.round(truth.confidence * 100)}% confidence.`;
            }
            
            return `Okay, I've added "${natural}" to my knowledge base.`;
        },
        
        generateFollowUpQuestion: (nalStatement) => {
            // Analyze statement to generate relevant follow-up
            if (nalStatement.includes('-->')) {
                const [subject, predicate] = extractInheritanceTerms(nalStatement);
                return `I see that ${subject} is a ${predicate}. ` +
                       `Are there other things that are also ${predicate}?`;
            }
            
            if (nalStatement.includes('==>')) {
                const [premise, conclusion] = extractImplicationTerms(nalStatement);
                return `Thanks for telling me that if ${premise} then ${conclusion}. ` +
                       `Have you observed any instances of ${premise} recently?`;
            }
            
            return "Is there anything else you'd like to tell me about this?";
        }
    };
}
```

**Key Benefits:**

- Lower barrier to entry by allowing natural language input
- More intuitive explanations that connect reasoning steps to everyday understanding
- Contextual follow-up questions that deepen knowledge acquisition
- Confidence explanations that help users understand the system's certainty levels
- Conversational interface that feels more like interacting with a knowledgeable partner

## 5. Collaborative Knowledge Building Workspace

```
function createCollaborativeWorkspace(nar, userId, userName) {
    return {
        init: () => {
            this.setupRealTimeSync();
            this.renderWorkspace();
            this.setupEventListeners();
        },
        
        renderWorkspace: () => {
            $('#workspace-container').html(`
                <div class="collaborative-workspace">
                    <div class="workspace-header">
                        <h2>Knowledge Building Workspace</h2>
                        <div class="workspace-controls">
                            <button id="save-workspace">Save</button>
                            <button id="share-workspace">Share</button>
                            <div class="online-users" id="online-users">
                                <span class="user-indicator" style="background-color: #4caf50"></span> You
                            </div>
                        </div>
                    </div>
                    
                    <div class="workspace-content">
                        <div class="knowledge-canvas" id="knowledge-canvas">
                            <!-- Knowledge canvas will be rendered here -->
                        </div>
                        
                        <div class="discussion-panel">
                            <div class="discussion-header">
                                <h3>Discussion</h3>
                                <span class="badge" id="discussion-badge">0</span>
                            </div>
                            <div class="messages" id="discussion-messages"></div>
                            <div class="message-input">
                                <input type="text" id="message-input" placeholder="Add a comment...">
                                <button id="send-message">Send</button>
                            </div>
                        </div>
                        
                        <div class="knowledge-panel">
                            <div class="panel-tabs">
                                <button class="active" data-panel="statements">Statements</button>
                                <button data-panel="questions">Questions</button>
                                <button data-panel="evidence">Evidence</button>
                            </div>
                            
                            <div class="panel-content">
                                <div id="statements-content" class="panel active">
                                    <div class="statement-filters">
                                        <input type="text" placeholder="Filter statements..." id="statement-filter">
                                        <select id="statement-sort">
                                            <option value="recent">Most Recent</option>
                                            <option value="confidence">Highest Confidence</option>
                                            <option value="activity">Most Active</option>
                                        </select>
                                    </div>
                                    <div id="statements-list" class="statements-list"></div>
                                </div>
                                
                                <div id="questions-content" class="panel hidden">
                                    <div class="questions-list" id="questions-list"></div>
                                </div>
                                
                                <div id="evidence-content" class="panel hidden">
                                    <div class="evidence-list" id="evidence-list"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `);
            
            // Render initial knowledge canvas
            this.renderKnowledgeCanvas();
            this.loadInitialContent();
        },
        
        setupRealTimeSync: () => {
            // Connect to collaboration server
            const socket = io('/collaboration');
            
            // Sync knowledge additions
            socket.on('statement-added', (data) => {
                if (data.userId !== userId) {
                    this.addRemoteStatement(data);
                }
            });
            
            // Sync questions
            socket.on('question-asked', (data) => {
                if (data.userId !== userId) {
                    this.displayQuestion(data);
                }
            });
            
            // Sync discussion messages
            socket.on('message', (message) => {
                this.addDiscussionMessage(message);
            });
            
            // Sync user presence
            socket.on('user-joined', (user) => {
                this.addUserIndicator(user);
            });
            
            socket.on('user-left', (userId) => {
                this.removeUserIndicator(userId);
            });
            
            // Setup local events to send to server
            nar.on('belief-added', (data) => {
                socket.emit('statement-added', {
                    userId,
                    userName,
                    statement: data.hyperedgeId,
                    truth: data.truth,
                    timestamp: Date.now()
                });
            });
        },
        
        addRemoteStatement: (data) => {
            // Visual indication of remote activity
            highlightUserActivity(data.userId);
            
            // Add to knowledge canvas
            this.knowledgeCanvas.addStatement(data.statement, {
                source: 'remote',
                userId: data.userId,
                userName: data.userName
            });
            
            // Add to statements list
            this.addStatementToList(data.statement, {
                userId: data.userId,
                userName: data.userName,
                timestamp: data.timestamp
            });
            
            // Optional: generate notification
            if (isRelevantToMe(data.statement)) {
                createNotification(`${data.userName} added: ${formatStatement(data.statement)}`);
            }
        },
        
        displayQuestion: (data) => {
            const questionElement = createQuestionElement(data);
            $('#questions-list').prepend(questionElement);
            
            // Auto-respond if it's relevant to our expertise
            if (nar.canAnswerQuestion(data.question)) {
                setTimeout(() => {
                    const answer = nar.getAnswer(data.question);
                    this.postAnswer(data.questionId, answer, data.userId);
                }, 1000 + Math.random() * 2000);
            }
        },
        
        postAnswer: (questionId, answer, targetUserId) => {
            // Post answer to discussion
            const message = `I believe ${formatAnswer(answer)}. ${nar.generateExplanation(answer.id)}`;
            this.addDiscussionMessage({
                userId,
                userName,
                content: message,
                timestamp: Date.now(),
                questionId
            });
            
            // Notify the question asker
            if (targetUserId !== userId) {
                socket.emit('answer', {
                    userId,
                    userName,
                    questionId,
                    answer,
                    timestamp: Date.now()
                });
            }
        },
        
        addDiscussionMessage: (message) => {
            const messageElement = `
                <div class="message" data-question-id="${message.questionId || ''}">
                    <div class="message-header">
                        <span class="user-name" style="color: ${getUserColor(message.userId)}">
                            ${message.userName}
                        </span>
                        <span class="timestamp">${formatTimestamp(message.timestamp)}</span>
                    </div>
                    <div class="message-content">${formatMessageContent(message.content)}</div>
                    <div class="message-actions">
                        <button class="action-like">👍 ${message.likes || 0}</button>
                        <button class="action-reply">Reply</button>
                    </div>
                </div>
            `;
            
            $('#discussion-messages').append(messageElement);
            updateDiscussionBadge();
            
            // Auto-scroll to bottom
            $('#discussion-messages').scrollTop($('#discussion-messages')[0].scrollHeight);
        },
        
        addStatementToList: (statement, metadata) => {
            const statementElement = `
                <div class="statement-item" data-statement-id="${statement}">
                    <div class="statement-header">
                        <span class="user-badge" style="background-color: ${getUserColor(metadata.userId)}">
                            ${metadata.userName.charAt(0)}
                        </span>
                        <span class="statement-text">${formatStatement(statement)}</span>
                    </div>
                    <div class="statement-meta">
                        <span class="confidence">Confidence: ${getConfidence(statement)}</span>
                        <span class="timestamp">${timeAgo(metadata.timestamp)}</span>
                    </div>
                    <div class="statement-actions">
                        <button class="action-support">Support (${getSupportCount(statement)})</button>
                        <button class="action-question">Question</button>
                        <button class="action-comment">Comment</button>
                    </div>
                </div>
            `;
            
            $('#statements-list').prepend(statementElement);
            
            // Setup event listeners for the new element
            $(`[data-statement-id="${statement}"] .action-support`).click(() => {
                this.supportStatement(statement);
            });
            
            $(`[data-statement-id="${statement}"] .action-question`).click(() => {
                this.askQuestionAboutStatement(statement);
            });
        },
        
        supportStatement: (statement) => {
            // Record support locally
            nar.recordSupport(userId, statement);
            
            // Sync with other users
            socket.emit('statement-supported', {
                userId,
                statement,
                timestamp: Date.now()
            });
            
            // Update UI
            updateSupportCount(statement, getSupportCount(statement) + 1);
        },
        
        askQuestionAboutStatement: (statement) => {
            const questionText = prompt(`What question do you have about "${formatStatement(statement)}"?`);
            if (questionText) {
                const questionId = generateQuestionId();
                
                // Post the question
                this.addDiscussionMessage({
                    userId,
                    userName,
                    content: `❓ Question about "${formatStatement(statement)}": ${questionText}`,
                    timestamp: Date.now(),
                    questionId
                });
                
                // Track it for answers
                trackQuestion(questionId, statement);
                
                // Sync with others
                socket.emit('question-asked', {
                    userId,
                    userName,
                    questionId,
                    statement,
                    question: questionText,
                    timestamp: Date.now()
                });
            }
        },
        
        renderKnowledgeCanvas: () => {
            // Initialize canvas with collaborative features
            this.knowledgeCanvas = new CollaborativeCanvas({
                container: '#knowledge-canvas',
                onStatementClick: (statementId) => {
                    showStatementDetails(statementId);
                },
                onCanvasClick: (position) => {
                    if (isInDrawingMode()) {
                        startNewStatement(position);
                    }
                },
                userColors: getUserColorMap()
            });
            
            // Add collaborative cursors
            this.userCursors = new UserCursorManager({
                canvas: this.knowledgeCanvas,
                getCurrentPosition: () => this.knowledgeCanvas.getCursorPosition()
            });
        },
        
        loadInitialContent: () => {
            // Load existing statements
            const statements = nar.getAllStatements();
            statements.forEach(statement => {
                this.knowledgeCanvas.addStatement(statement);
            });
            
            // Load discussion history
            loadDiscussionHistory().then(messages => {
                messages.forEach(message => {
                    this.addDiscussionMessage(message);
                });
            });
            
            // Load current users
            getCurrentUsers().then(users => {
                users.forEach(user => {
                    if (user.id !== userId) {
                        this.addUserIndicator(user);
                    }
                });
            });
        }
    };
}
```

**Key Benefits:**

- Real-time collaboration on knowledge building
- Visual indication of other users' activities and focus areas
- Integrated discussion that links directly to specific knowledge elements
- Social validation through support/like mechanisms
- Collective question-answering where multiple users can contribute perspectives
- Preservation of provenance (who contributed what and when)

These UI enhancements would transform NARHyper from a technical reasoning engine into a comprehensive knowledge
management and reasoning platform that's accessible to domain experts without programming or formal logic expertise.
