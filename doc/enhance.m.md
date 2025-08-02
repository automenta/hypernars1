# Deep Learning Integration Enhancements for NARHyper

Below are four ambitious yet practical enhancements that integrate deep learning techniques with NARHyper's
non-axiomatic reasoning framework. Each proposal maintains the system's symbolic integrity while leveraging neural
capabilities to overcome specific limitations.

## 1. Neural-Guided Inference with Uncertainty-Aware Prioritization

**Problem Addressed**: NARHyper's priority queue helps manage combinatorial explosion, but still evaluates many
low-value paths. Current priority calculations lack context-awareness about which inference paths will yield the most
valuable conclusions.

**Innovation**: A Bayesian neural network that predicts high-value inference paths while quantifying its own
uncertainty, dynamically adjusting computational resource allocation.

**Pseudocode**:

```pseudocode
class UncertaintyAwareInferenceGuide:
    def __init__(self, narhyper):
        self.narhyper = narhyper
        # Bayesian Transformer for context-aware path prediction
        self.path_predictor = BayesianTransformer(
            input_dim=EMBEDDING_SIZE*3,  # premise, conclusion, current context
            hidden_dim=256,
            num_layers=4,
            num_mc_samples=20
        )
        # Experience replay for learning from inference outcomes
        self.replay_buffer = PrioritizedReplayBuffer(capacity=5000)
        # Dynamic threshold for path exploration
        self.exploration_threshold = 0.3
        
    def prioritize_inference_path(self, event):
        """
        Enhances event priority based on neural prediction of path value
        Returns modified event with adjusted priority
        """
        # Extract relevant context for prediction
        context = self._extract_inference_context(event)
        
        # Get prediction with uncertainty estimation
        predicted_value, uncertainty = self._predict_path_value(context)
        
        # Adjust exploration threshold based on system resource pressure
        current_load = self.narhyper.get_resource_utilization()
        dynamic_threshold = self.exploration_threshold * (1 + current_load)
        
        # Only follow neural guidance when uncertainty is low enough
        if uncertainty < dynamic_threshold:
            # Boost priority for high-value paths
            enhancement_factor = 1.0 + min(0.5, predicted_value * 0.8)
            event.budget.priority = min(1.0, event.budget.priority * enhancement_factor)
        else:
            # When uncertain, maintain original priority but mark for exploration
            event.metadata["high_uncertainty"] = True
            
        return event
    
    def _extract_inference_context(self, event):
        """Creates feature vector capturing current inference context"""
        # Get term embeddings (symbolic or learned)
        target_emb = self.narhyper.get_term_embedding(event.target)
        premise_emb = self.narhyper.get_term_embedding(event.premise)
        
        # Extract structural features
        structural_features = [
            self.narhyper.get_in_degree(event.target),
            self.narhyper.get_out_degree(event.target),
            self.narhyper.get_belief_count(event.target),
            self.narhyper.get_temporal_relevance(event.target)
        ]
        
        # Extract recent activation history
        activation_history = self.narhyper.get_recent_activations(
            event.target, window=5
        )
        
        # Current question context (if any)
        question_context = self.narhyper.get_current_question_embedding()
        
        return {
            "target_embedding": target_emb,
            "premise_embedding": premise_emb,
            "structural_features": structural_features,
            "activation_history": activation_history,
            "question_context": question_context,
            "path_length": event.path_length,
            "current_priority": event.budget.priority
        }
    
    def _predict_path_value(self, context):
        """Predicts path value with uncertainty quantification"""
        # Convert context to feature vector
        features = self._context_to_features(context)
        
        # Multiple forward passes for Bayesian estimation
        predictions = []
        for _ in range(self.path_predictor.num_mc_samples):
            predictions.append(self.path_predictor(features))
        
        # Calculate mean prediction and uncertainty
        mean_prediction = torch.mean(torch.stack(predictions))
        uncertainty = torch.var(torch.stack(predictions))
        
        return mean_prediction.item(), uncertainty.item()
    
    def record_inference_outcome(self, path_id, final_value, path_quality):
        """
        Records inference path outcomes for training
        final_value: actual utility of derived knowledge
        path_quality: how efficiently the path was traversed
        """
        # Retrieve context that led to this path
        context = self.replay_buffer.get_context(path_id)
        if not context:
            return
            
        # Calculate reward signal
        reward = self._calculate_path_reward(final_value, path_quality)
        
        # Store experience with prioritization based on surprise
        priority = abs(reward - context["predicted_value"])
        self.replay_buffer.add(
            context, reward, priority=priority
        )
        
        # Periodically train the model
        if random.random() < TRAINING_PROBABILITY:
            self._train_from_experience()
    
    def _calculate_path_reward(self, value, quality):
        """Computes reward signal for reinforcement learning"""
        # Value components
        novelty = self.narhyper.calculate_novelty(value)
        relevance = self.narhyper.calculate_relevance(value)
        correctness = self.narhyper.estimate_correctness(value)
        
        # Quality components
        efficiency = quality["computation_efficiency"]
        coherence = quality["belief_coherence"]
        
        return (0.3 * novelty + 0.25 * relevance + 0.2 * correctness +
                0.15 * efficiency + 0.1 * coherence)
    
    def _train_from_experience(self, batch_size=32):
        """Trains the path predictor using experience replay"""
        if len(self.replay_buffer) < batch_size:
            return
            
        # Sample prioritized batch
        batch, indices, weights = self.replay_buffer.sample(batch_size)
        
        # Process batch
        predictions = []
        targets = []
        
        for context, reward in batch:
            # Get prediction
            pred, _ = self._predict_path_value(context)
            predictions.append(pred)
            
            # Calculate target value
            target = reward + GAMMA * context.get("next_value", 0)
            targets.append(target)
        
        # Calculate loss with uncertainty weighting
        predictions = torch.tensor(predictions)
        targets = torch.tensor(targets)
        loss = F.mse_loss(predictions, targets, reduction='none')
        
        # Apply importance weights and uncertainty adjustment
        weighted_loss = (loss * torch.tensor(weights) * 
                        (1.0 / (context["uncertainty"] + 1e-6)))
        total_loss = weighted_loss.mean()
        
        # Update priorities based on TD error
        td_errors = (predictions - targets).abs().detach().numpy()
        self.replay_buffer.update_priorities(indices, td_errors)
        
        # Backpropagate
        optimizer.zero_grad()
        total_loss.backward()
        optimizer.step()
```

**Why this is valuable**: This enhancement transforms NARHyper from a system that merely filters low-priority paths to
one that actively seeks the most promising inference trajectories. The uncertainty quantification prevents over-reliance
on neural guidance when the model lacks confidence, preserving the system's reliability while improving efficiency.

## 2. Differentiable Symbol Grounding with Cross-Modal Alignment

**Problem Addressed**: NARHyper maintains symbolic representations but lacks connection to sensory data. Real-world
applications need to ground symbols in perceptual experiences without resorting to lossy embeddings.

**Innovation**: A differentiable grounding mechanism that creates bidirectional mappings between symbolic terms and
multimodal representations while preserving symbolic integrity.

**Pseudocode**:

```pseudocode
class SymbolGroundingModule:
    def __init__(self, narhyper, vision_model, language_model):
        self.narhyper = narhyper
        self.vision_model = vision_model  # Pre-trained vision transformer
        self.language_model = language_model  # Pre-trained language model
        # Differentiable symbol-to-percept mapping
        self.symbol_to_percept = DifferentiableMapper(
            input_dim=SYMBOL_EMBEDDING_SIZE,
            output_dim=PERCEPT_EMBEDDING_SIZE
        )
        # Percept-to-symbol classifier with contrastive learning
        self.percept_to_symbol = ContrastiveClassifier(
            input_dim=PERCEPT_EMBEDDING_SIZE,
            output_dim=SYMBOL_VOCAB_SIZE
        )
        # Cross-modal alignment network
        self.cross_modal_aligner = CrossModalAligner()
        # Symbol-percept association memory
        self.association_memory = AssociationMemory(capacity=10000)
        
    def ground_symbol(self, symbol, perceptual_data):
        """
        Creates or strengthens symbol-percept association
        perceptual_data: { "image": tensor, "audio": tensor, "text": string }
        """
        # Generate multimodal embeddings
        percept_embeddings = self._encode_percept(perceptual_data)
        symbol_embedding = self.narhyper.get_symbolic_embedding(symbol)
        
        # Compute cross-modal alignment
        alignment_score = self.cross_modal_aligner(
            symbol_embedding, percept_embeddings
        )
        
        # Create truth value based on alignment confidence
        confidence = torch.sigmoid(alignment_score).item()
        truth = TruthValue(frequency=1.0, confidence=confidence)
        
        # Add to association memory
        self.association_memory.add(
            symbol, percept_embeddings, confidence
        )
        
        # Update differentiable mappings
        self._update_mappings(symbol, percept_embeddings)
        
        # Return grounded symbol with truth value
        return self.narhyper.term(symbol, { "truth": truth })
    
    def _encode_percept(self, perceptual_data):
        """Encodes multimodal data into unified representation"""
        embeddings = {}
        
        # Image encoding
        if "image" in perceptual_data:
            img_emb = self.vision_model(perceptual_data["image"])
            embeddings["visual"] = img_emb
            
        # Text encoding
        if "text" in perceptual_data:
            text_emb = self.language_model.encode(perceptual_data["text"])
            embeddings["textual"] = text_emb
            
        # Audio encoding
        if "audio" in perceptual_data:
            audio_emb = self.audio_model(perceptual_data["audio"])
            embeddings["auditory"] = audio_emb
        
        # Fuse modalities
        return self._fuse_modalities(embeddings)
    
    def _fuse_modalities(self, embeddings):
        """Fuses multiple perceptual modalities into unified representation"""
        # Simple attention-based fusion
        keys = list(embeddings.keys())
        values = [embeddings[k] for k in keys]
        
        # Compute attention weights
        combined = torch.mean(torch.stack(values), dim=0)
        attention = F.softmax(torch.matmul(values, combined.T), dim=0)
        
        # Weighted combination
        return torch.sum(torch.stack(values) * attention.unsqueeze(-1), dim=0)
    
    def _update_mappings(self, symbol, percept_embeddings):
        """Updates differentiable mappings based on new evidence"""
        symbol_embedding = self.narhyper.get_symbolic_embedding(symbol)
        
        # Forward pass through symbol-to-percept mapper
        predicted_percept = self.symbol_to_percept(symbol_embedding)
        
        # Compute reconstruction loss
        reconstruction_loss = F.mse_loss(predicted_percept, percept_embeddings)
        
        # Update percept-to-symbol classifier with contrastive learning
        positive_samples = [percept_embeddings]
        negative_samples = self.association_memory.get_negative_samples(symbol)
        contrastive_loss = self.percept_to_symbol.compute_loss(
            percept_embeddings, positive_samples, negative_samples
        )
        
        # Combined loss
        loss = reconstruction_loss + 0.5 * contrastive_loss
        
        # Backpropagate
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
        
        # Update association strengths
        self._update_association_strengths(symbol, percept_embeddings)
    
    def _update_association_strengths(self, symbol, percept_embeddings):
        """Updates symbol-percept association strengths"""
        # Get current associations
        associations = self.association_memory.get_associations(symbol)
        
        # Compute similarity with existing associations
        similarities = []
        for assoc in associations:
            sim = cosine_similarity(percept_embeddings, assoc["embedding"])
            similarities.append(sim)
        
        # If highly similar to existing association, update it
        if similarities and max(similarities) > SIMILARITY_THRESHOLD:
            idx = similarities.index(max(similarities))
            self.association_memory.update_strength(
                symbol, idx, max(similarities)
            )
        else:
            # Otherwise, add as new association
            self.association_memory.add(symbol, percept_embeddings, 1.0)
    
    def query_grounding(self, symbol, perceptual_query):
        """
        Answers whether a percept matches a symbol's grounding
        Returns truth value representing match confidence
        """
        # Encode the query
        query_embedding = self._encode_percept(perceptual_query)
        
        # Get symbol's perceptual associations
        associations = self.association_memory.get_associations(symbol)
        
        # Compute match scores with all associations
        match_scores = []
        for assoc in associations:
            score = cosine_similarity(query_embedding, assoc["embedding"])
            match_scores.append(score * assoc["strength"])
        
        # Aggregate match scores
        if not match_scores:
            return TruthValue(frequency=0.5, confidence=0.1)
        
        max_score = max(match_scores)
        avg_score = sum(match_scores) / len(match_scores)
        
        # Convert to truth value
        frequency = min(1.0, max_score * 1.2)  # Allow slight extrapolation
        confidence = min(1.0, avg_score * 1.5)  # Higher confidence with multiple matches
        
        return TruthValue(frequency=frequency, confidence=confidence)
    
    def explain_grounding(self, symbol):
        """Provides explanation of a symbol's perceptual grounding"""
        associations = self.association_memory.get_associations(symbol)
        
        # Find most representative association
        if not associations:
            return f"Symbol '{symbol}' has no perceptual grounding"
        
        strongest = max(associations, key=lambda x: x["strength"])
        
        # Generate natural language explanation
        explanation = self.language_model.generate(
            f"Explain the visual characteristics of {symbol}",
            context_embedding=strongest["embedding"]
        )
        
        return {
            "symbol": symbol,
            "explanation": explanation,
            "confidence": strongest["strength"],
            "evidence_count": len(associations)
        }
```

**Why this is valuable**: This enhancement creates a true bridge between symbolic reasoning and perceptual reality
without sacrificing the precision of symbolic representations. Unlike standard embedding approaches that collapse rich
symbolic structures into vectors, this maintains symbolic integrity while providing grounded meaning - crucial for
applications like robotics and embodied AI.

## 3. Meta-Learning for Adaptive Reasoning Strategies

**Problem Addressed**: NARHyper applies the same derivation rules universally, but different domains and tasks require
different reasoning strategies. The system lacks the ability to adapt its reasoning approach based on context.

**Innovation**: A meta-learning framework that dynamically selects and weights derivation rules based on task context,
with the ability to rapidly adapt to new domains.

**Pseudocode**:

```pseudocode
class MetaReasoningAdaptor:
    def __init__(self, narhyper):
        self.narhyper = narhyper
        # Context encoder that understands current reasoning situation
        self.context_encoder = TransformerEncoder(
            input_dim=CONTEXT_FEATURE_SIZE,
            hidden_dim=256,
            num_layers=3
        )
        # Rule adapter that generates task-specific rule weights
        self.rule_adapter = HyperNetwork(
            input_dim=256,  # Context encoding
            base_network_dims=[128, RULE_COUNT]
        )
        # Performance tracker for each rule in different contexts
        self.performance_tracker = ContextualPerformanceTracker()
        # Domain adaptation module
        self.domain_adapter = DomainAdapter()
        # Rule effectiveness predictor
        self.effectiveness_predictor = RuleEffectivenessPredictor()
        
    def adapt_derivation_rules(self, event):
        """
        Dynamically adapts derivation rules for current context
        Returns filtered and weighted rule set
        """
        # Encode current reasoning context
        context_embedding = self._encode_reasoning_context(event)
        
        # Generate rule weights for this context
        rule_weights = self.rule_adapter(context_embedding)
        
        # Get available rules from NARHyper
        available_rules = self.narhyper.get_available_derivation_rules(event)
        
        # Filter and weight rules
        adapted_rules = []
        for i, rule in enumerate(available_rules):
            # Apply context-specific weight
            weight = rule_weights[i].item()
            
            # Adjust based on historical performance in similar contexts
            historical_perf = self.performance_tracker.get_performance(
                rule.name, context_embedding
            )
            adjusted_weight = weight * (0.7 + 0.3 * historical_perf)
            
            # Only include rules above threshold
            if adjusted_weight > RULE_THRESHOLD:
                adapted_rules.append((rule, adjusted_weight))
        
        # Sort by weight
        adapted_rules.sort(key=lambda x: x[1], reverse=True)
        return adapted_rules
    
    def _encode_reasoning_context(self, event):
        """Creates embedding of current reasoning context"""
        features = []
        
        # Target term characteristics
        target = event.target
        features.extend([
            self.narhyper.get_in_degree(target),
            self.narhyper.get_out_degree(target),
            self.narhyper.get_belief_count(target),
            self.narhyper.get_temporal_relevance(target)
        ])
        
        # Current task features
        current_task = self.narhyper.get_current_task()
        if current_task:
            features.extend([
                TASK_TYPE_ENCODING[current_task.type],
                current_task.complexity,
                current_task.urgency
            ])
        
        # Resource situation
        resources = self.narhyper.get_resource_status()
        features.extend([
            resources["cpu_utilization"],
            resources["memory_pressure"],
            resources["inference_queue_length"]
        ])
        
        # Recent success patterns
        recent_successes = self.performance_tracker.get_recent_successes()
        features.extend(recent_successes)
        
        # Convert to tensor and encode
        context_tensor = torch.tensor(features, dtype=torch.float)
        return self.context_encoder(context_tensor)
    
    def record_rule_outcome(self, rule, context, success, quality):
        """
        Records outcome of rule application for meta-learning
        success: boolean indicating if rule produced useful result
        quality: float measuring value of the result (0-1)
        """
        # Update performance tracker
        self.performance_tracker.update(
            rule.name, context, success, quality
        )
        
        # Store for meta-training
        self.performance_tracker.store_experience(
            rule.name, context, success, quality
        )
        
        # Periodically update rule adapter
        if random.random() < META_TRAINING_PROBABILITY:
            self._meta_train()
    
    def _meta_train(self):
        """Meta-trains the rule adaptation system"""
        # Sample experiences
        experiences = self.performance_tracker.sample_experiences(
            batch_size=META_BATCH_SIZE
        )
        
        if not experiences:
            return
            
        # Prepare data
        contexts = []
        rule_successes = []
        
        for exp in experiences:
            contexts.append(exp["context"])
            # One-hot encoding of successful rules
            success_vec = [0.0] * RULE_COUNT
            for rule_name, success in exp["rule_successes"].items():
                rule_idx = RULE_NAME_TO_IDX[rule_name]
                success_vec[rule_idx] = 1.0 if success else 0.0
            rule_successes.append(success_vec)
        
        contexts_tensor = torch.stack(contexts)
        successes_tensor = torch.tensor(rule_successes)
        
        # Forward pass
        predicted_weights = self.rule_adapter(contexts_tensor)
        
        # Calculate loss (focusing on relative rule effectiveness)
        loss = self._weighted_bce_loss(predicted_weights, successes_tensor)
        
        # Backpropagate
        meta_optimizer.zero_grad()
        loss.backward()
        meta_optimizer.step()
    
    def _weighted_bce_loss(self, predictions, targets):
        """Weighted binary cross entropy that emphasizes relative ranking"""
        # Calculate standard BCE
        bce = F.binary_cross_entropy_with_logits(
            predictions, targets, reduction='none'
        )
        
        # Create weights that emphasize ranking errors
        # Higher weight for cases where the model ranks a failing rule higher than a successful one
        ranking_weights = torch.ones_like(bce)
        for i in range(len(targets)):
            successful = targets[i] > 0.5
            predicted_order = torch.argsort(predictions[i], descending=True)
            
            # Find first successful rule in prediction order
            first_success = None
            for idx in predicted_order:
                if successful[idx]:
                    first_success = idx
                    break
            
            # If no successful rules were predicted highly, increase loss
            if first_success is None:
                ranking_weights[i] *= 2.0
            else:
                # Increase weight for rules ranked above first success but not successful
                for j in range(predicted_order.index(first_success)):
                    rule_idx = predicted_order[j]
                    if not successful[rule_idx]:
                        ranking_weights[i, rule_idx] *= 1.5
        
        return (bce * ranking_weights).mean()
    
    def adapt_to_new_domain(self, domain_examples, adaptation_steps=50):
        """
        Rapidly adapts reasoning strategy to a new domain
        domain_examples: list of (premise, conclusion, truth) examples
        """
        # Analyze domain characteristics
        domain_features = self._analyze_domain_features(domain_examples)
        
        # Generate synthetic training tasks
        synthetic_tasks = self.domain_adapter.generate_tasks(
            domain_features, count=SYNTHETIC_TASK_COUNT
        )
        
        # Perform rapid adaptation
        original_params = self.rule_adapter.get_params()
        
        for _ in range(adaptation_steps):
            # Sample task
            task = random.choice(synthetic_tasks)
            
            # Forward on task
            context = self._encode_reasoning_context(task["context"])
            rule_weights = self.rule_adapter(context)
            
            # Compute task loss
            loss = self._compute_task_loss(rule_weights, task["expected_rules"])
            
            # Inner update (fast adaptation)
            fast_params = self.rule_adapter.update_params(
                loss, step_size=FAST_LEARNING_RATE
            )
            
            # Validation on related task
            val_task = self.domain_adapter.get_validation_task(task)
            val_context = self._encode_reasoning_context(val_task["context"])
            val_weights = self.rule_adapter(val_context, params=fast_params)
            val_loss = self._compute_task_loss(val_weights, val_task["expected_rules"])
            
            # Outer update (meta update)
            meta_optimizer.zero_grad()
            val_loss.backward()
            meta_optimizer.step()
        
        # Update performance tracker for new domain
        self.performance_tracker.register_new_domain(
            domain_features, self.rule_adapter.get_params()
        )
    
    def _analyze_domain_features(self, examples):
        """Analyzes key characteristics of a reasoning domain"""
        features = {
            "temporal_density": self._estimate_temporal_density(examples),
            "causal_complexity": self._estimate_causal_complexity(examples),
            "abstraction_level": self._estimate_abstraction_level(examples),
            "noise_level": self._estimate_noise_level(examples),
            "rule_interdependence": self._estimate_rule_interdependence(examples)
        }
        
        # Encode as feature vector
        return self.domain_adapter.feature_encoder(features)
```

**Why this is valuable**: This transforms NARHyper from a one-size-fits-all reasoning system into an adaptive framework
that automatically optimizes its reasoning strategy for different domains and tasks. The meta-learning approach allows
rapid adaptation to new scenarios with minimal examples, making the system significantly more versatile while
maintaining the interpretability of symbolic reasoning.

## 4. Neural-Enhanced Belief Revision with Epistemic Uncertainty

**Problem Addressed**: NARHyper's belief revision uses fixed mathematical formulas that don't account for complex
epistemic relationships between pieces of evidence. The current system treats all evidence equally regardless of
context.

**Innovation**: A neural belief revision system that models complex evidence relationships and quantifies different
types of uncertainty (aleatoric, epistemic, and temporal).

**Pseudocode**:

```pseudocode
class NeuralBeliefRevisionSystem:
    def __init__(self, narhyper):
        self.narhyper = narhyper
        # Bayesian network for belief revision
        self.belief_reviser = BayesianRevisionNetwork(
            input_dim=REVISION_INPUT_SIZE,  # Multiple evidence features
            hidden_dim=192,
            num_layers=3,
            num_mc_samples=30
        )
        # Uncertainty decomposition module
        self.uncertainty_analyzer = UncertaintyDecomposer()
        # Evidence relationship tracker
        self.evidence_graph = EvidenceRelationshipGraph()
        # Revision experience buffer
        self.experience_buffer = RevisionExperienceBuffer(capacity=5000)
        
    def revise_belief(self, existing_belief, new_evidence, context=None):
        """
        Neural-enhanced belief revision with uncertainty quantification
        Returns revised truth value and uncertainty metrics
        """
        # Standard NARS revision as fallback
        standard_revision = TruthValue.revise(existing_belief, new_evidence)
        
        # Prepare revision context
        revision_context = self._prepare_revision_context(
            existing_belief, new_evidence, context
        )
        
        # Neural revision with uncertainty estimation
        neural_revision, uncertainty = self._neural_revision(revision_context)
        
        # Determine revision approach based on uncertainty
        if uncertainty["total"] < UNCERTAINTY_THRESHOLD:
            # Trust neural revision when uncertainty is low
            return self._apply_neural_revision(
                existing_belief, neural_revision, uncertainty
            )
        else:
            # Fall back to standard revision with explanation
            return self._explain_revision_choice(
                standard_revision, neural_revision, uncertainty
            )
    
    def _prepare_revision_context(self, existing, evidence, context=None):
        """Prepares comprehensive context for belief revision"""
        # Basic truth value features
        features = [
            existing.frequency, existing.confidence, existing.priority,
            evidence.frequency, evidence.confidence, evidence.priority
        ]
        
        # Evidence relationship features
        relationship = self.evidence_graph.get_relationship(
            existing.source, evidence.source
        )
        features.extend([
            relationship["similarity"],
            relationship["temporal_proximity"],
            relationship["causal_relevance"]
        ])
        
        # Contextual features (if provided)
        if context:
            features.extend([
                context["task_urgency"],
                context["domain_complexity"],
                context["resource_pressure"]
            ])
        else:
            features.extend([0.5, 0.5, 0.5])  # Neutral defaults
        
        # Source credibility features
        source_credibility = self._estimate_source_credibility(evidence.source)
        features.append(source_credibility)
        
        # Convert to tensor
        return torch.tensor(features, dtype=torch.float)
    
    def _neural_revision(self, context):
        """Performs belief revision with uncertainty quantification"""
        # Multiple forward passes for Bayesian estimation
        frequency_preds = []
        confidence_preds = []
        priority_preds = []
        
        for _ in range(self.belief_reviser.num_mc_samples):
            output = self.belief_reviser(context)
            frequency_preds.append(output[0])
            confidence_preds.append(output[1])
            priority_preds.append(output[2])
        
        # Calculate mean predictions
        frequency = torch.mean(torch.stack(frequency_preds)).item()
        confidence = torch.mean(torch.stack(confidence_preds)).item()
        priority = torch.mean(torch.stack(priority_preds)).item()
        
        # Calculate uncertainty components
        aleatoric = self.uncertainty_analyzer.calculate_aleatoric(
            frequency_preds, confidence_preds, priority_preds
        )
        epistemic = self.uncertainty_analyzer.calculate_epistemic(
            frequency_preds, confidence_preds, priority_preds
        )
        temporal = self.uncertainty_analyzer.calculate_temporal(
            context
        )
        
        # Create revised truth value
        revised = TruthValue(
            frequency=min(1.0, max(0.0, frequency)),
            confidence=min(1.0, max(0.0, confidence)),
            priority=min(1.0, max(0.0, priority))
        )
        
        # Package uncertainty metrics
        uncertainty = {
            "aleatoric": aleatoric,
            "epistemic": epistemic,
            "temporal": temporal,
            "total": (aleatoric + epistemic + temporal) / 3
        }
        
        return revised, uncertainty
    
    def _apply_neural_revision(self, existing, neural, uncertainty):
        """Applies neural revision with appropriate uncertainty handling"""
        # Adjust confidence based on uncertainty components
        adjusted_confidence = neural.confidence * (
            1.0 - min(0.8, uncertainty["total"])
        )
        
        # Create final truth value
        final_truth = TruthValue(
            frequency=neural.frequency,
            confidence=adjusted_confidence,
            priority=neural.priority
        )
        
        # Record for learning
        self.experience_buffer.add(
            existing, neural, final_truth, uncertainty
        )
        
        return final_truth
    
    def _explain_revision_choice(self, standard, neural, uncertainty):
        """Explains why standard revision was chosen over neural"""
        # Create explanation of uncertainty
        explanation = (
            f"Chose standard revision due to high uncertainty "
            f"(total: {uncertainty['total']:.2f}). "
            f"Aleatoric: {uncertainty['aleatoric']:.2f}, "
            f"Epistemic: {uncertainty['epistemic']:.2f}, "
            f"Temporal: {uncertainty['temporal']:.2f}."
        )
        
        # Record decision for learning
        self.experience_buffer.add_with_explanation(
            standard, neural, uncertainty, explanation
        )
        
        return standard
    
    def learn_from_revision_outcomes(self, revision_id, ground_truth, feedback):
        """
        Updates the revision system based on outcomes
        ground_truth: actual truth value (when available)
        feedback: user/system feedback on revision quality
        """
        # Retrieve the revision context
        context = self.experience_buffer.get_context(revision_id)
        if not context:
            return
            
        # Calculate revision error
        error = self._calculate_revision_error(
            context["revision"], ground_truth
        )
        
        # Update evidence relationships
        self._update_evidence_relationships(
            context["existing"], context["evidence"], error
        )
        
        # Store for training with prioritization
        priority = error + feedback.get("importance", 0.5)
        self.experience_buffer.update_priority(
            revision_id, priority
        )
        
        # Periodically train the model
        if len(self.experience_buffer) > MIN_TRAINING_SIZE:
            self._train_revision_network()
    
    def _calculate_revision_error(self, revision, ground_truth):
        """Calculates error between revision and ground truth"""
        # Frequency error (weighted more heavily)
        freq_error = abs(revision.frequency - ground_truth.frequency) * 0.6
        
        # Confidence error
        conf_error = abs(revision.confidence - ground_truth.confidence) * 0.4
        
        return freq_error + conf_error
    
    def _update_evidence_relationships(self, existing, evidence, error):
        """Updates evidence relationship graph based on revision error"""
        # Get or create relationship
        rel = self.evidence_graph.get_relationship(
            existing.source, evidence.source
        )
        
        # Update relationship strength based on error
        # Lower error means stronger positive relationship
        relationship_strength = max(0.1, 1.0 - error)
        
        # Update temporal relevance
        time_diff = abs(existing.timestamp - evidence.timestamp)
        temporal_relevance = math.exp(-0.1 * time_diff)
        
        # Update the relationship
        self.evidence_graph.update_relationship(
            existing.source, evidence.source,
            similarity=relationship_strength,
            temporal_proximity=temporal_relevance,
            error_history=error
        )
    
    def _train_revision_network(self, batch_size=64):
        """Trains the belief revision network"""
        # Sample prioritized batch
        batch, indices, weights = self.experience_buffer.sample(batch_size)
        
        # Process batch
        inputs = []
        targets = []
        
        for item in batch:
            inputs.append(item["context"])
            targets.append([
                item["ground_truth"].frequency,
                item["ground_truth"].confidence,
                item["ground_truth"].priority
            ])
        
        inputs_tensor = torch.stack(inputs)
        targets_tensor = torch.tensor(targets)
        
        # Forward pass
        outputs = self.belief_reviser(inputs_tensor)
        
        # Calculate loss with uncertainty weighting
        loss = F.mse_loss(outputs, targets_tensor, reduction='none')
        
        # Apply importance weights
        weighted_loss = (loss * torch.tensor(weights).unsqueeze(1))
        total_loss = weighted_loss.mean()
        
        # Update priorities based on error
        errors = torch.sqrt(weighted_loss.mean(dim=1)).detach().numpy()
        self.experience_buffer.update_priorities(indices, errors)
        
        # Backpropagate
        optimizer.zero_grad()
        total_loss.backward()
        optimizer.step()
    
    def explain_revision(self, existing, new_evidence):
        """Provides explanation of how belief was revised"""
        # Get neural revision and uncertainty
        context = self._prepare_revision_context(existing, new_evidence)
        neural_revision, uncertainty = self._neural_revision(context)
        
        # Analyze key factors in revision
        factors = self._analyze_revision_factors(existing, new_evidence, context)
        
        # Generate natural language explanation
        explanation = (
            f"Revised belief from frequency {existing.frequency:.2f} to {neural_revision.frequency:.2f} "
            f"and confidence {existing.confidence:.2f} to {neural_revision.confidence:.2f}. "
        )
        
        # Add key factor explanations
        if factors["source_credibility"] > 0.7:
            explanation += "This revision heavily weighted due to high source credibility. "
        if factors["temporal_relevance"] > 0.8:
            explanation += "The new evidence was particularly timely. "
        if factors["evidence_alignment"] > 0.75:
            explanation += "The new evidence strongly aligned with existing knowledge. "
            
        # Add uncertainty explanation
        explanation += f"Revision uncertainty: total={uncertainty['total']:.2f} "
        explanation += f"(aleatoric={uncertainty['aleatoric']:.2f}, "
        explanation += f"epistemic={uncertainty['epistemic']:.2f}, "
        explanation += f"temporal={uncertainty['temporal']:.2f})"
        
        return explanation
    
    def _analyze_revision_factors(self, existing, evidence, context):
        """Analyzes key factors influencing the revision"""
        # Source credibility
        source_cred = self._estimate_source_credibility(evidence.source)
        
        # Temporal relevance
        time_diff = abs(existing.timestamp - evidence.timestamp)
        temporal_rel = math.exp(-0.05 * time_diff)
        
        # Evidence alignment
        alignment = self.evidence_graph.get_relationship(
            existing.source, evidence.source
        )["similarity"]
        
        # Domain complexity factor
        domain_factor = context[-3]  # From context features
        
        return {
            "source_credibility": source_cred,
            "temporal_relevance": temporal_rel,
            "evidence_alignment": alignment,
            "domain_factor": domain_factor
        }
```

**Why this is valuable**: This enhancement transforms belief revision from a mechanical calculation into a nuanced
process that accounts for the complex relationships between pieces of evidence. The explicit modeling of different
uncertainty types provides richer meta-knowledge about beliefs, while the evidence relationship graph captures how
different sources interact - making the system's reasoning more human-like and contextually appropriate.
