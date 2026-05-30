'use strict';

// Principle 3: Intrinsic networks. Several always-on, anti-correlated sub-
// networks: default-mode (spontaneous thought when idle), action-mode (engages
// on input), salience (arbiter), and a frontoparietal control network.
// Source: Dosenbach et al. (2025) action-mode network.
class IntrinsicNetworks {
  constructor(config) {
    this.config = config;
    this.mode = { dmn: 0.6, action: 0.2, salience: 0.2, control: 0.3 };
    this.idleTicks = 0;
  }

  // Update mode weights from current input drive & salience, enforcing the DMN
  // <-> action-mode anti-correlation, then inject the corresponding activity.
  update(populations, inputDrive, salience, neuromods) {
    const engaged = inputDrive > 0.05 || salience > 0.1;
    if (engaged) this.idleTicks = 0; else this.idleTicks++;

    // Salience network arbitrates: spikes on surprise.
    this.mode.salience += 0.2 * (salience - this.mode.salience);
    // Action-mode tracks engagement; DMN is its anti-correlate.
    const target = engaged ? 1 : 0;
    this.mode.action += 0.1 * (target - this.mode.action);
    this.mode.dmn += 0.1 * ((1 - target) - this.mode.dmn);
    // Control net rises with salience + dopamine (task control).
    const da = neuromods ? neuromods.level.da : 0.5;
    this.mode.control += 0.1 * (clamp01(0.4 * this.mode.salience + 0.6 * da) - this.mode.control);

    const region = this.config.regions.find((r) => r.name === 'IntrinsicNets');
    if (!region) return;
    // DMN drives spontaneous activity when idle ("thinking at rest").
    if (this.mode.dmn > 0.5) {
      const amt = this.mode.dmn * 1.2;
      const step = Math.max(1, Math.floor(region.count / 128));
      for (let i = region.start; i < region.end; i += step) {
        populations.current[i] += amt * Math.sin(i * 0.013 + this.idleTicks * 0.01);
      }
    }
    // Action-mode sharpens cortical drive (gain on PFC) during engagement.
    if (this.mode.action > 0.5) {
      const pfc = this.config.regions.find((r) => r.name === 'PFC');
      if (pfc) {
        const step = Math.max(1, Math.floor(pfc.count / 128));
        for (let i = pfc.start; i < pfc.end; i += step) populations.current[i] += this.mode.action * 0.8;
      }
    }
  }

  isResting() {
    return this.mode.dmn > 0.5;
  }

  toJSON() {
    return { mode: this.mode, idleTicks: this.idleTicks };
  }

  load(obj) {
    if (!obj) return;
    this.mode = obj.mode || this.mode;
    this.idleTicks = obj.idleTicks || 0;
  }
}

function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

module.exports = { IntrinsicNetworks };
