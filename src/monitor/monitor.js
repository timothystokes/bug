'use strict';

// Principle 1: E/I balance via aperiodic (1/f) statistics of the firing trace.
// Principle 20: self-monitoring of complexity / synergistic self-information.
// Principle: criticality / edge-of-chaos tracked as a health metric.
class Monitor {
  constructor() {
    this.firingHistory = new Float32Array(256); // rolling global firing rate
    this.hist = 0;
    this.eiRatio = 4.0;     // E:I activity ratio
    this.aperiodicSlope = 0; // 1/f-like slope proxy
    this.complexity = 0;     // network complexity signal
    this.synergy = 0;        // synergistic self-information proxy
    this.criticality = 0;    // branching-ratio proxy (1.0 = critical)
    this.prevSpikes = 1;
  }

  // Called each tick with this tick's spike counts.
  observe(populations, totalSpikes) {
    // E vs I activity.
    let eSpk = 0;
    let iSpk = 0;
    const spike = populations.spike;
    const type = populations.type;
    const n = populations.n;
    const step = Math.max(1, Math.floor(n / 50000));
    for (let i = 0; i < n; i += step) {
      if (spike[i]) { if (type[i] === 0) eSpk++; else iSpk++; }
    }
    this.eiRatio = iSpk > 0 ? eSpk / iSpk : eSpk;

    // Rolling firing-rate ring for spectral/aperiodic estimate.
    this.firingHistory[this.hist % this.firingHistory.length] = totalSpikes / n;
    this.hist++;

    // Branching ratio (criticality): spikes_t / spikes_{t-1}.
    this.criticality = 0.99 * this.criticality + 0.01 * (totalSpikes / Math.max(1, this.prevSpikes));
    this.prevSpikes = Math.max(1, totalSpikes);
  }

  // Slower, more expensive analysis (called off the hot path).
  analyse() {
    const h = this.firingHistory;
    const len = h.length;
    // Aperiodic slope proxy: ratio of low-frequency to high-frequency power via
    // a cheap difference-variance estimate. Steeper (more negative) = more
    // inhibition-dominated; flatter = more excitation (per the E/I literature).
    let lowVar = 0;
    let highVar = 0;
    let mean = 0;
    for (let i = 0; i < len; i++) mean += h[i];
    mean /= len;
    for (let i = 1; i < len; i++) {
      const d = h[i] - h[i - 1];
      highVar += d * d;               // high-frequency content
      lowVar += (h[i] - mean) * (h[i] - mean); // total variance
    }
    this.aperiodicSlope = -(highVar / (lowVar + 1e-9));

    // Complexity: balance between integration and differentiation. Use
    // normalised entropy of the firing-rate distribution times its variance —
    // high when activity is both varied and structured (neither flat nor saturated).
    const bins = 16;
    const counts = new Float32Array(bins);
    let max = 1e-9;
    for (let i = 0; i < len; i++) if (h[i] > max) max = h[i];
    for (let i = 0; i < len; i++) {
      const b = Math.min(bins - 1, Math.floor((h[i] / max) * bins));
      counts[b]++;
    }
    let entropy = 0;
    for (let b = 0; b < bins; b++) {
      const p = counts[b] / len;
      if (p > 0) entropy -= p * Math.log2(p);
    }
    const normEntropy = entropy / Math.log2(bins);
    let variance = 0;
    for (let i = 0; i < len; i++) variance += (h[i] - mean) * (h[i] - mean);
    variance /= len;
    this.complexity = normEntropy * Math.sqrt(variance) * 100;

    // Synergistic self-information proxy (PID-flavoured): how much the whole
    // trace tells you beyond its mean — entropy weighted by deviation from a
    // memoryless baseline.
    this.synergy = normEntropy * (1 - Math.exp(-variance * 50));
    return this.snapshot();
  }

  snapshot() {
    return {
      eiRatio: this.eiRatio,
      aperiodicSlope: this.aperiodicSlope,
      complexity: this.complexity,
      synergy: this.synergy,
      criticality: this.criticality,
    };
  }

  toJSON() {
    return this.snapshot();
  }

  load(obj) {
    if (!obj) return;
    this.eiRatio = obj.eiRatio || this.eiRatio;
    this.complexity = obj.complexity || 0;
    this.synergy = obj.synergy || 0;
    this.criticality = obj.criticality || 0;
    this.aperiodicSlope = obj.aperiodicSlope || 0;
  }
}

module.exports = { Monitor };
