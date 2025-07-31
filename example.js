import { NARHyper } from './src/NARHyper.js';

/**
 * Autonomous Vehicle Reasoning System using NARHyper
 * Demonstrates:
 * - Full NAL syntax support
 * - Advanced derivation rules (induction, abduction, analogy)
 * - NAL question processing
 * - Contradictory evidence handling
 * - Explanation tracing
 * - Event listeners
 */

// Initialize the NAR system
const vehicleReasoning = new NARHyper({
  decay: 0.1,
  budgetDecay: 0.75,
  inferenceThreshold: 0.2,
  maxPathLength: 25,
  beliefCapacity: 12,
  temporalHorizon: 10,
  questionTimeout: 5000
});

// Listen for belief additions
vehicleReasoning.on('belief-added', ({ hyperedgeId, truth, expectation }) => {
  if (hyperedgeId.includes('hazard') && expectation > 0.7) {
    console.log(`\x1b[31m⚠️ Critical hazard detected: ${hyperedgeId} (expectation: ${expectation.toFixed(2)})\x1b[0m`);
  }
});

// Listen for question answers
vehicleReasoning.on('question-answer', ({ questionId, answer }) => {
  const question = questionId.replace(/^Question\(|\|.*$/g, '');
  if (question.includes('hazard') && answer.truth.expectation() > 0.6) {
    console.log(`\x1b[33m❓ Answer to "${question}": ${answer.type}(${answer.args.join(',')}) [${answer.truth.expectation().toFixed(2)}]\x1b[0m`);
  }
});

// ===== 1. DEFINE VEHICLE ONTOLOGY (USING NAL SYNTAX) =====

console.log('Loading vehicle knowledge base...');

// Road elements
vehicleReasoning.nal('<road --> surface>. %0.95;0.9%');
vehicleReasoning.nal('<intersection --> road>. %0.9;0.85%');
vehicleReasoning.nal('<pedestrian_crossing --> road>. %0.85;0.8%');
vehicleReasoning.nal('<traffic_light --> control_device>. %0.95;0.9%');
vehicleReasoning.nal('<stop_sign --> control_device>. %0.9;0.85%');

// Vehicle states
vehicleReasoning.nal('<moving --> vehicle_state>. %0.9;0.85%');
vehicleReasoning.nal('<stopped --> vehicle_state>. %0.9;0.85%');
vehicleReasoning.nal('<turning_left --> vehicle_state>. %0.8;0.75%');
vehicleReasoning.nal('<turning_right --> vehicle_state>. %0.8;0.75%');

// Hazards
vehicleReasoning.nal('<pedestrian --> hazard>. %0.85;0.8%');
vehicleReasoning.nal('<cyclist --> hazard>. %0.8;0.75%');
vehicleReasoning.nal('<stopped_vehicle --> hazard>. %0.75;0.7%');
vehicleReasoning.nal('<red_light --> hazard>. %0.9;0.85%');
vehicleReasoning.nal('<yellow_light --> hazard>. %0.7;0.65%');

// Relationships
vehicleReasoning.nal('<red_light --> stop_required>. %0.95;0.9%');
vehicleReasoning.nal('<yellow_light --> slow_down>. %0.9;0.85%');
vehicleReasoning.nal('<green_light --> proceed>. %0.95;0.9%');
vehicleReasoning.nal('<pedestrian --> yield_required>. %0.9;0.85%');
vehicleReasoning.nal('<cyclist --> caution_required>. %0.85;0.8%');

// Similarities
vehicleReasoning.nal('<pedestrian <-> cyclist>. %0.6;0.65%');
vehicleReasoning.nal('<red_light <-> stop_sign>. %0.5;0.55%');

// Implications
vehicleReasoning.nal('<red_light ==> stop_required>. %0.95;0.9%');
vehicleReasoning.nal('<yellow_light ==> slow_down>. %0.9;0.85%');
vehicleReasoning.nal('<green_light ==> proceed>. %0.95;0.9%');
vehicleReasoning.nal('<pedestrian ==> yield_required>. %0.9;0.85%');
vehicleReasoning.nal('<cyclist ==> caution_required>. %0.85;0.8%');
vehicleReasoning.nal('<intersection && red_light ==> stop_required>. %0.92;0.88%');
vehicleReasoning.nal('<pedestrian_crossing && pedestrian ==> yield_required>. %0.93;0.89%');

// ===== 2. SIMULATE VEHICLE SENSORS =====

console.log('\nSimulating vehicle sensors...');

// Current context
vehicleReasoning.observe('at_intersection', vehicleReasoning.truth(1.0, 0.95));
vehicleReasoning.observe('traffic_light_state=red', vehicleReasoning.truth(0.95, 0.9));
vehicleReasoning.observe('pedestrian_detected', vehicleReasoning.truth(0.85, 0.8));

// Add temporal sequence
const driveStart = Date.now();
vehicleReasoning.seq(
  'vehicle_starts',
  'approaches_intersection',
  'detects_traffic_light',
  'detects_pedestrian',
  'makes_decision'
);

// ===== 3. PROCESS VEHICLE DECISIONS =====

console.log('\nProcessing vehicle decisions...');

// Ask critical questions
const hazardPromise = vehicleReasoning.nalq('<$x --> hazard>?', { minExpectation: 0.6 }).catch(e => console.error(`Hazard question failed: ${e.message}`));
const actionPromise = vehicleReasoning.nalq('<$x --> required_action>?', { minExpectation: 0.7 }).catch(e => console.error(`Action question failed: ${e.message}`));

// Run inference engine
const steps = vehicleReasoning.run(500, (nar, step) => {
  if (step % 100 === 0) process.stdout.write(`.`);
});

console.log(`\nCompleted ${steps} inference steps\n`);

// ===== 4. DISPLAY DECISION RESULTS =====

console.log('===== VEHICLE DECISION RESULTS =====\n');

// Get hazard analysis
hazardPromise.then(answer => {
  if (!answer) {
    console.log('No significant hazard identified.');
    return;
  }
  console.log('Identified hazards:');
  console.log(`- ${answer.args[0]} (expectation: ${answer.truth.expectation().toFixed(2)})`);

  // Show reasoning path
  console.log('\nReasoning path for hazard identification:');
  console.log(vehicleReasoning.explain(`Inheritance(${answer.args[0]},hazard)`));

  // Show belief table
  console.log('\nBelief table:');
  console.table(vehicleReasoning.beliefTable(`Inheritance(${answer.args[0]},hazard)`));
});

// Get required action
actionPromise.then(answer => {
    if (!answer) {
        console.log('No required action identified.');
        return;
    }
  console.log('\nRequired action:');
  console.log(`- ${answer.args[0]}`);

  // Check if we need to stop
  if (vehicleReasoning.evaluate('stop_required?')) {
    console.log('\n\x1b[32m✅ Decision: Full stop required\x1b[0m');
  } else if (vehicleReasoning.evaluate('slow_down?')) {
    console.log('\n\x1b[33m⚠️ Decision: Slow down required\x1b[0m');
  } else {
    console.log('\n\x1b[34m➡️ Decision: Safe to proceed\x1b[0m');
  }
});

// ===== 5. SIMULATE NEW SENSOR DATA =====

console.log('\n\nSimulating new sensor data...');

// Update with more precise information
vehicleReasoning.revise(
  'Inheritance(pedestrian,hazard)',
  vehicleReasoning.truth(0.95, 0.92),
  vehicleReasoning.budget(0.95, 0.9, 0.92)
);

vehicleReasoning.observe('pedestrian_crossing_street', vehicleReasoning.truth(0.9, 0.85));

// Run additional inference
vehicleReasoning.run(100);

// ===== 6. FINAL DECISION =====

console.log('\n\n===== FINAL DECISION =====');

// Check if pedestrian is crossing
if (vehicleReasoning.evaluate('pedestrian_crossing_street?')) {
  console.log('Pedestrian is actively crossing the street');
  console.log('Final action: \x1b[31m🛑 FULL STOP REQUIRED\x1b[0m');
} else {
  console.log('Pedestrian is on sidewalk but not crossing');
  console.log('Final action: \x1b[33m⚠️ Prepare to stop\x1b[0m');
}

// ===== 7. MACRO FUNCTION DEMONSTRATION =====

console.log('\n\n===== MACRO FUNCTION DEMONSTRATION =====');

// Using nalq() macro for complex query
vehicleReasoning.nalq('<($x && $y) --> required_action>?', { minExpectation: 0.65 })
  .then(answer => {
    if (!answer) return;
    console.log('\nComplex query result:');
    console.log(`When ${answer.args[0]} and ${answer.args[1]}, required action is ${answer.args[2]}`);
  }).catch(e => console.error(`Complex query failed: ${e.message}`));

// Using compound() macro
const turningScenario = vehicleReasoning.compound('Product', 'at_intersection', 'turning_right');
console.log(`\nCreated compound term: ${turningScenario}`);

// Using image macros
const imageExtId = vehicleReasoning.imageExt('required_action', 'turning_right', 2);
const imageIntId = vehicleReasoning.imageInt('required_action', 'at_intersection', 1);
console.log('Created image terms:');
console.log(`- ImageExt: ${imageExtId}`);
console.log(`- ImageInt: ${imageIntId}`);

// Run final inference
vehicleReasoning.run(50);

console.log('\n\nVehicle reasoning system complete. Ready for deployment!');
