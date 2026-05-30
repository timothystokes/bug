'use strict';

// Principle 13 (glial support) + source: Palmer et al. (2026) astrocytic
// resource diffusion. A scalar metabolic "fuel" per neuron diffuses across the
// network and gates/stabilises persistent activity independently of synaptic
// weight. Depleted by firing, replenished by diffusion from the global pool.
class Glia {
  constructor(n) {
    this.n = n;
    this.resource = new Float32Array(n); // 0..1 fuel per cell
    this.resource.fill(1.0);
    this.pool = 1.0;          // global recycling pool level (0..1)
    this.diffusion = 0.02;    // how fast fuel equalises toward the pool
    this.consumption = 0.05;  // fuel burned per spike
    this.recovery = 0.01;     // baseline recovery toward pool
  }

  // Returns a per-tick gain multiplier and updates fuel. Cells low on fuel
  // contribute less, which stabilises runaway activity (criticality control).
  modulate(populations) {
    const { resource } = this;
    const spike = populations.spike;
    const current = populations.current;
    let used = 0;
    for (let i = 0; i < this.n; i++) {
      if (spike[i]) {
        resource[i] -= this.consumption;
        used += this.consumption;
        if (resource[i] < 0) resource[i] = 0;
      }
      // Diffuse toward pool + slow recovery.
      resource[i] += this.diffusion * (this.pool - resource[i]) + this.recovery * (1 - resource[i]);
      if (resource[i] > 1) resource[i] = 1;
      // Gate the *next* tick's input by available fuel.
      current[i] *= 0.5 + 0.5 * resource[i];
    }
    // Pool slowly refills, drained by aggregate consumption.
    this.pool += 0.001 * (1 - this.pool) - 0.0001 * used;
    if (this.pool < 0.1) this.pool = 0.1;
    if (this.pool > 1) this.pool = 1;
  }

  mean() {
    let s = 0;
    for (let i = 0; i < this.n; i++) s += this.resource[i];
    return s / this.n;
  }
}

module.exports = { Glia };
