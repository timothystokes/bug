'use strict';

// Principle 7: Neuromodulation & affect. Five global broadcast scalars analogous
// to dopamine, serotonin, noradrenaline, acetylcholine and cortisol. They drift
// back toward genome-biased homeostatic set-points and are nudged by events
// (reward prediction error, novelty, stress). Provides the "mood" layer that
// gates how strongly experiences are written to memory.
const CHANNELS = ['da', 'serotonin', 'ne', 'ach', 'cortisol'];

class Neuromodulators {
  constructor(genome) {
    this.setpoints = {};
    this.level = {};
    for (const c of CHANNELS) {
      const sp = 0.5 + (genome ? genome.neuromodSetpointBias[c] : 0);
      this.setpoints[c] = sp;
      this.level[c] = sp;
    }
    this.decay = 0.02; // rate of return to set-point
    // RPE bookkeeping.
    this.expectedReward = 0;
  }

  // Slow homeostatic relaxation toward set-points (called on the slow clock).
  relax() {
    for (const c of CHANNELS) {
      this.level[c] += this.decay * (this.setpoints[c] - this.level[c]);
      this.clamp(c);
    }
  }

  clamp(c) {
    if (this.level[c] < 0) this.level[c] = 0;
    if (this.level[c] > 1) this.level[c] = 1;
  }

  // Principle 5: reward prediction error. Dopamine encodes actual-minus-expected.
  rewardPredictionError(actualReward) {
    const rpe = actualReward - this.expectedReward;
    this.expectedReward += 0.1 * rpe; // value learning
    this.level.da = clamp01(0.5 + rpe);
    return rpe;
  }

  // Novelty/surprise raises NE & ACh (attention/learning gain).
  surprise(amount) {
    this.level.ne = clamp01(this.level.ne + 0.3 * amount);
    this.level.ach = clamp01(this.level.ach + 0.2 * amount);
  }

  // Stress raises cortisol; sustained stress lowers serotonin (mood).
  stress(amount) {
    this.level.cortisol = clamp01(this.level.cortisol + 0.2 * amount);
    this.level.serotonin = clamp01(this.level.serotonin - 0.05 * amount);
  }

  // Net plasticity gain from the modulators (dopamine + acetylcholine up,
  // excess cortisol down). Used to scale STDP / Hebbian updates.
  plasticityGain() {
    return clamp01(0.5 + 0.6 * (this.level.da - 0.5) + 0.4 * (this.level.ach - 0.5)
      - 0.3 * (this.level.cortisol - 0.5));
  }

  // Exploration drive (noradrenaline + dopamine) for action selection.
  explorationDrive(genome) {
    const base = genome ? genome.explorationBaseline : 0.2;
    return clamp01(base + 0.3 * (this.level.ne - 0.5) + 0.2 * (this.level.da - 0.5));
  }

  // Excitability gain broadcast to neurons (acetylcholine-like).
  gain() {
    return 0.8 + 0.4 * this.level.ach;
  }

  toJSON() {
    return { setpoints: this.setpoints, level: this.level, expectedReward: this.expectedReward };
  }

  load(obj) {
    this.setpoints = obj.setpoints;
    this.level = obj.level;
    this.expectedReward = obj.expectedReward || 0;
  }
}

function clamp01(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

module.exports = { Neuromodulators, CHANNELS };
