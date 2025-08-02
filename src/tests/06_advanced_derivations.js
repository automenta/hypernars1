export default {
  name: '6. Advanced Derivations',
  description: 'Tests advanced derivation rules like Property Inheritance and Induction Inheritance.',
  run: (nar, log) => {
    log("===== 6. ADVANCED DERIVATIONS =====");

    // Test Property Inheritance
    log("\n--- Property Inheritance ---");
    nar.nal('dog.'); // Term: dog
    nar.nal('<(dog * entity) --> mammal>.'); // Dog is a mammal (entity)
    nar.nal('Property(mammal, has_fur).'); // Mammals have fur
    nar.run(10);

    const dogHasFurId = nar.inheritance('dog', 'Property(dog, has_fur)');
    const dogHasFurBelief = nar.getBeliefs(dogHasFurId)[0];
    log(`Belief that Dog has fur: ${dogHasFurBelief ? dogHasFurBelief.truth.expectation().toFixed(3) : 'N/A'}`);

    // Test Induction Inheritance
    log("\n--- Induction Inheritance ---");
    nar.nal('cat.');
    nar.nal('<(cat * entity) --> mammal>.');
    nar.nal('<(dog * entity) --> mammal>.');
    nar.run(10);

    const catIsSimilarToDogId = nar.similarity('cat', 'dog');
    const catIsSimilarToDogBelief = nar.getBeliefs(catIsSimilarToDogId)[0];
    log(`Belief that Cat is similar to Dog: ${catIsSimilarToDogBelief ? catIsSimilarToDogBelief.truth.expectation().toFixed(3) : 'N/A'}`);

    return "Advanced derivations tests complete.";
  }
};
