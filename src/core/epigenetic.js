'use strict';

// Principle 8: Epigenetic / slow-regulatory layer. A slow timescale of gene-like
// regulatory state sits above synaptic weights and changes *which* plasticity
// rules are active and their gains, producing developmental phases and trait-
// like stability. Source: Roy et al. (2025) lncRNA epigenetics of mood.
// Principle 10: Lifespan / developmental trajectory (critical period ->
// consolidation -> senescence pruning) is implemented as the age-dependent
// modulation of this layer.
class Epigenetic {
  constructor(genome) {
    this.genome = genome;
    this.simDays = 0;          // developmental age in simulated days (continuous float)
    this.lastDayProcessed = 0; // last integer day for which side-effects ran
    // Which plasticity rules are active and at what gain.
    this.rules = {
      predictiveCoding: 1.0,
      stdp: 1.0,
      rpe: 1.0,
      hippocampalWrite: 1.0,
    };
    this.pruningPressure = 0.0; // rises in senescence
  }

  // Critical-period plasticity multiplier: very high early, decays with age,
  // floored so the adult brain still learns slowly.
  plasticityMultiplier() {
    const decay = this.genome ? this.genome.plasticityDecay : 0.999;
    const base = Math.max(0.15, Math.pow(decay, this.simDays * 100));
    return base * 2.0;
  }

  phase() {
    if (this.simDays < 3) return 'critical-period';
    if (this.simDays < 20) return 'consolidation';
    return 'senescence';
  }

  // Continuous time advance: called every tick with the elapsed sim-time.
  // Phase-dependent rule updates fire each time we cross an integer day.
  // Returns true if a day boundary was crossed (for logging).
  advance(deltaSimDays, synapses) {
    this.simDays += deltaSimDays;
    const wholeDay = Math.floor(this.simDays);
    if (wholeDay <= this.lastDayProcessed) return false;
    this.lastDayProcessed = wholeDay;
    this.applyPhaseRules(synapses);
    return true;
  }

  // Legacy entry point: advance exactly one whole sim-day (used by sleep cycles).
  tickDay(synapses) {
    this.simDays = Math.floor(this.simDays) + 1;
    this.lastDayProcessed = Math.floor(this.simDays);
    this.applyPhaseRules(synapses);
  }

  applyPhaseRules(synapses) {
    const phase = this.phase();
    if (phase === 'critical-period') {
      this.rules.stdp = 1.2;
      this.rules.hippocampalWrite = 1.3;
    } else if (phase === 'consolidation') {
      this.rules.stdp = 1.0;
      this.rules.hippocampalWrite = 1.0;
    } else {
      // Senescence: pruning dominates, network sparsifies but stabilises.
      this.rules.stdp = 0.6;
      this.rules.hippocampalWrite = 0.7;
      this.pruningPressure = Math.min(1, this.pruningPressure + 0.05);
      if (synapses) this.prune(synapses);
    }
  }

  // Senescence pruning: weak synapses are zeroed (myelination-like efficiency).
  prune(synapses) {
    const thresh = 0.02 * this.pruningPressure;
    let pruned = 0;
    const w = synapses.weight;
    for (let k = 0; k < w.length; k++) {
      if (Math.abs(w[k]) < thresh) { w[k] = 0; pruned++; }
    }
    return pruned;
  }

  toJSON() {
    return {
      simDays: this.simDays,
      lastDayProcessed: this.lastDayProcessed,
      rules: this.rules,
      pruningPressure: this.pruningPressure,
    };
  }

  load(obj) {
    if (!obj) return;
    this.simDays = obj.simDays || 0;
    this.lastDayProcessed = obj.lastDayProcessed != null ? obj.lastDayProcessed : Math.floor(this.simDays);
    this.rules = obj.rules || this.rules;
    this.pruningPressure = obj.pruningPressure || 0;
  }
}

module.exports = { Epigenetic };
