export default {
  name: '3. Temporal Reasoning',
  description: 'Demonstrates the system\'s ability to reason about time-based events.',
  run: (nar, log) => {
    log("===== 3. TEMPORAL REASONING =====");
    const now = Date.now();
    const morning = nar.temporalManager.interval('daytime_event', now, now + 4 * 3600 * 1000);
    const meeting = nar.temporalManager.interval('important_meeting', now + 1 * 3600 * 1000, now + 2 * 3600 * 1000);

    const relId = nar.temporalManager.addConstraint(meeting, morning, 'during', { truth: new nar.api.TruthValue(1, 0.9) });
    log("Established that the meeting happens during the day.");

    const meetingInterval = nar.temporalManager.intervals.get(meeting);
    const morningInterval = nar.temporalManager.intervals.get(morning);

    if (meetingInterval && morningInterval) {
        log(`Meeting relation to Morning: ${meetingInterval.relateTo(morningInterval)}`);
        log(`Morning relation to Meeting: ${morningInterval.relateTo(meetingInterval)}`);
    }
    return "Temporal reasoning demo complete.";
  }
};
