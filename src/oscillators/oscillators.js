'use strict';

// Principle 14: Oscillatory binding. Several coexisting rhythms (theta/alpha/
// beta/gamma analogues) provide a temporal coordinate system. Units that fire in
// the same gamma phase are treated as bound into a single percept.
class Oscillators {
  constructor(bands) {
    this.bands = bands; // { theta, alpha, beta, gamma } frequencies (Hz-analogue)
    this.phase = {};
    for (const k of Object.keys(bands)) this.phase[k] = 0;
    this.dtSeconds = 0.001; // 1 ms-analogue per tick
  }

  step() {
    for (const k of Object.keys(this.bands)) {
      this.phase[k] = (this.phase[k] + 2 * Math.PI * this.bands[k] * this.dtSeconds) % (2 * Math.PI);
    }
  }

  // Phase value (0..2pi) used to label co-firing units into the same percept.
  gammaPhase() {
    return this.phase.gamma;
  }

  // Discrete gamma-phase bin (binding tag) for the current tick.
  bindingTag(nbins = 8) {
    return Math.floor((this.phase.gamma / (2 * Math.PI)) * nbins) % nbins;
  }

  // Theta-phase gain: excitability waxes/wanes with theta (memory encoding).
  thetaGain() {
    return 0.85 + 0.15 * Math.sin(this.phase.theta);
  }

  toJSON() {
    return { phase: this.phase };
  }

  load(obj) {
    if (obj && obj.phase) this.phase = obj.phase;
  }
}

module.exports = { Oscillators };
