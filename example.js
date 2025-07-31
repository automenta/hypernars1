import { NARHyper } from './src/NARHyper.js';

async function main() {
    console.log("Initializing NARHyper...");
    const nar = new NARHyper({
        // Custom config to make console output more predictable
        decay: 0.05,
        budgetDecay: 0.9,
        inferenceThreshold: 0.2
    });

    // Set up a listener to see what's happening internally
    nar.on('belief-added', (data) => {
        // console.log(`[Belief Added] ${data.hyperedgeId} - f:${data.truth.frequency.toFixed(2)} c:${data.truth.confidence.toFixed(2)}`);
    });
    nar.on('contradiction-resolved', (data) => {
        console.log(`\\n[!] Contradiction Resolved for ${data.hyperedgeId} via ${data.strategy}`);
    });
    nar.on('focus-changed', (data) => {
        console.log(`\\n[*] Meta-Reasoner changed focus to: ${data.newFocus}`);
    });

    console.log("\\n===== 1. ADVANCED NAL PARSING & BASIC INFERENCE =====");
    nar.nal('<(bird * animal) --> flyer>. %0.9;0.8%');
    nar.nal('<penguin --> (bird * !flyer)>. #0.95#'); // Using priority instead of truth
    nar.nal('<tweety --> bird>.');
    console.log("Initial beliefs added.");

    console.log("\nRunning system for 50 steps to allow initial inferences...");
    nar.run(50);

    const tweetyIsAnimalId = nar.inheritance('tweety', 'animal');
    const tweetyIsFlyerId = nar.inheritance('tweety', 'flyer');

    console.log(`Belief that Tweety is an animal:`, nar.getBeliefs(tweetyIsAnimalId)[0]?.truth.expectation().toFixed(3));
    console.log(`Belief that Tweety is a flyer:`, nar.getBeliefs(tweetyIsFlyerId)[0]?.truth.expectation().toFixed(3));

    console.log("\\n===== 2. CONTRADICTION & RESOLUTION =====");
    console.log("\nIntroducing belief that Tweety is a penguin...");
    nar.nal('<tweety --> penguin>. %0.99;0.99%');

    console.log("Running system for 100 steps to process the new information and resolve contradictions...");
    nar.run(100);

    console.log(`\nNew belief that Tweety is a flyer:`, nar.getBeliefs(tweetyIsFlyerId)[0]?.truth.expectation().toFixed(3));
    console.log("--- Explanation for Tweety's flying status after new info ---");
    console.log(nar.explain(tweetyIsFlyerId, { format: 'detailed' }));

    console.log("\\n===== 3. TEMPORAL REASONING =====");
    const morning = nar.temporalManager.interval('daytime_event', Date.now(), Date.now() + 4 * 3600 * 1000);
    const meeting = nar.temporalManager.interval('important_meeting', Date.now() + 1 * 3600 * 1000, Date.now() + 2 * 3600 * 1000);

    const relId = nar.temporalManager.temporalRelation(meeting, morning, 'during', { truth: nar.truth(1, 0.9) });
    console.log("Established that the meeting happens during the day.");
    console.log(`Relation ID: ${relId}`);

    const meetingInterval = nar.temporalManager.temporalIntervals.get(meeting);
    const morningInterval = nar.temporalManager.temporalIntervals.get(morning);

    if (meetingInterval && morningInterval) {
        console.log(`Meeting relation to Morning: ${meetingInterval.relateTo(morningInterval)}`);
        console.log(`Morning relation to Meeting: ${morningInterval.relateTo(meetingInterval)}`);
    }

    console.log("\\n===== 4. META-REASONING & ADAPTATION =====");
    console.log("Current resource policy (budgetThreshold):", nar.config.budgetThreshold.toFixed(4));
    console.log("Simulating high question load to trigger adaptation...");

    // Ask a series of questions to increase pressure
    nar.ask('<tweety --> ?x>?').catch(e => {});
    nar.ask('<penguin --> ?x>?').catch(e => {});
    nar.ask('<bird --> ?x>?').catch(e => {});
    nar.ask('<animal --> ?x>?').catch(e => {});

    console.log("Running system for 120 steps...");
    nar.run(120); // This will trigger the maintenance cycle which includes meta-reasoning

    console.log("New resource policy (budgetThreshold):", nar.config.budgetThreshold.toFixed(4));

    console.log("\\n===== 5. FINAL EXPLANATION DEMO =====");
    console.log("\n--- Final Story about why Tweety is an animal ---");
    console.log(nar.explain(tweetyIsAnimalId, { format: 'story' }));

    console.log("\nDemonstration complete.");
}

main().catch(console.error);
