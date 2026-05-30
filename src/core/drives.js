'use strict';

// Homeostatic drive variables (README "Neuromodulation & affect"): energy,
// novelty and social drives generate intrinsic goals that bias action selection
// and neuromodulator tone, so the brain is self-motivated rather than purely
// stimulus-driven.
class Drives {
  constructor() {
    this.energy = 1.0;   // depleted by activity, restored by sleep
    this.novelty = 0.5;  // satisfied by surprising input, decays toward hunger
    this.social = 0.5;   // satisfied by I/O interaction (input + own output)
  }

  // Update each tick from activity and interaction signals.
  update(spikeFraction, salience, interacted) {
    this.energy -= spikeFraction * 0.001;
    this.energy += 0.0002; // slow baseline recovery
    this.energy = clamp01(this.energy);
    // Novelty drive rises when input is stale, falls when surprised.
    this.novelty += 0.0005 - 0.5 * salience * 0.001;
    this.novelty = clamp01(this.novelty);
    this.social += interacted ? -0.002 : 0.0003;
    this.social = clamp01(this.social);
  }

  // Restore energy during sleep.
  rest() { this.energy = clamp01(this.energy + 0.2); }

  // Intrinsic goal pressure influencing exploration (curiosity).
  curiosity() { return clamp01(0.5 * this.novelty + 0.3 * this.social + 0.2 * (1 - this.energy)); }

  toJSON() { return { energy: this.energy, novelty: this.novelty, social: this.social }; }

  load(obj) {
    if (!obj) return;
    this.energy = obj.energy != null ? obj.energy : 1.0;
    this.novelty = obj.novelty != null ? obj.novelty : 0.5;
    this.social = obj.social != null ? obj.social : 0.5;
  }
}

function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

module.exports = { Drives };
