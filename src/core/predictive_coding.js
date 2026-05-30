'use strict';

// Principle 16: Predictive coding everywhere. Every region predicts its own next
// input from its current state + a slow top-down prior, and only the prediction-
// error residual propagates upward. The magnitude of the residual is the
// intrinsic reward signal (Principle 5 RPE is a special case) and the gate on
// local Hebbian plasticity.
const SLABS = 16; // low-dimensional summary per region

class PredictiveCoding {
  constructor(config) {
    this.config = config;
    this.K = SLABS;
    this.predicted = {};   // region -> Float32Array(K)
    this.prior = {};       // slow top-down prior
    this.errorMag = {};    // region -> scalar |error|
    for (const r of config.regions) {
      this.predicted[r.name] = new Float32Array(this.K);
      this.prior[r.name] = new Float32Array(this.K);
      this.errorMag[r.name] = 0;
    }
    this.totalError = 1.0; // smoothed global prediction error (should fall with learning)
  }

  // Compute a K-dim activity summary of a region from current spike rates.
  summarise(region, populations) {
    const out = new Float32Array(this.K);
    const slab = Math.max(1, Math.floor(region.count / this.K));
    for (let k = 0; k < this.K; k++) {
      let s = 0;
      const base = region.start + k * slab;
      const end = Math.min(region.end, base + slab);
      for (let i = base; i < end; i++) s += populations.rate[i];
      out[k] = s / Math.max(1, end - base);
    }
    return out;
  }

  // Run prediction-error for every region; inject residual into the current of
  // a higher region (cortical hierarchy: sensory -> PFC), and return total error.
  tick(populations, plasticityGain) {
    const T = this.config.tunables;
    let total = 0;
    const pfc = this.config.regions.find((r) => r.name === 'PFC');
    for (const region of this.config.regions) {
      const actual = this.summarise(region, populations);
      const pred = this.predicted[region.name];
      const prior = this.prior[region.name];
      let err = 0;
      for (let k = 0; k < this.K; k++) {
        const residual = actual[k] - (pred[k] + 0.2 * prior[k]);
        err += residual * residual;
        // Local Hebbian update of the predictor, gated by error x plasticity.
        pred[k] += T.pcLearnRate * plasticityGain * residual;
        // Slow prior tracks the predictor.
        prior[k] += 0.001 * (pred[k] - prior[k]);
        // Propagate residual upward into PFC (only the residual, not content).
        if (pfc && region.name !== 'PFC' && Math.abs(residual) > 0.001) {
          const target = pfc.start + ((k * 7 + region.index) % pfc.count);
          populations.current[target] += residual * 4.0;
        }
      }
      err = Math.sqrt(err / this.K);
      this.errorMag[region.name] = err;
      total += err;
    }
    total /= this.config.regions.length;
    this.totalError = 0.995 * this.totalError + 0.005 * total;
    return total;
  }

  toJSON() {
    const pred = {};
    const prior = {};
    for (const k of Object.keys(this.predicted)) {
      pred[k] = Array.from(this.predicted[k]);
      prior[k] = Array.from(this.prior[k]);
    }
    return { predicted: pred, prior, totalError: this.totalError };
  }

  load(obj) {
    if (!obj) return;
    this.totalError = obj.totalError != null ? obj.totalError : 1.0;
    for (const k of Object.keys(obj.predicted || {})) {
      if (this.predicted[k]) this.predicted[k].set(obj.predicted[k]);
      if (this.prior[k]) this.prior[k].set(obj.prior[k]);
    }
  }
}

module.exports = { PredictiveCoding, SLABS };
