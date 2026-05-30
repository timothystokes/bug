'use strict';

const { TYPE_E } = require('../populations/populations');

const MAX_DELAY = 16; // ms-analogue conduction-delay ring size

// Sparse synapse store in CSR form keyed by presynaptic neuron.
// Principle 13 (Dale's Law): synapse sign is fixed by the presynaptic cell type.
// Principle 16/5 (predictive coding / RPE): each synapse carries an eligibility
// trace so a global dopamine scalar can gate consolidation.
// Principle 18 (sparse coding): activity is kept sparse; weights stay bounded.
class Synapses {
  constructor() {
    this.n = 0;
    this.m = 0;
    // Forward CSR (by presynaptic neuron).
    this.offsets = null; // Uint32Array(n+1)
    this.post = null;    // Uint32Array(m)
    this.weight = null;  // Float32Array(m) signed by Dale's Law
    this.delay = null;   // Uint8Array(m)
    this.elig = null;    // Float32Array(m) eligibility trace for RPE gating
    // Reverse CSR (by postsynaptic neuron) -> indices into forward arrays.
    this.inOffsets = null; // Uint32Array(n+1)
    this.inIdx = null;     // Uint32Array(m)
    // Conduction-delay delivery ring.
    this.ring = null;      // Float32Array(MAX_DELAY * n)
  }

  // Build sparse connectivity from the region x region connectome prior.
  static build(config, populations, rng) {
    const syn = new Synapses();
    const n = config.nNeurons;
    syn.n = n;
    const regions = config.regions;
    const density = config.synapseDensity;
    const T = config.tunables;

    // Per-source-region cumulative target-region distribution.
    const regionByName = {};
    for (const r of regions) regionByName[r.name] = r;
    const dists = regions.map((src) => {
      const weights = regions.map((dst) => {
        if (dst.name === src.name) return 1.0; // strong within-region
        const prior = (config.connectomePrior[src.name] || {})[dst.name];
        return prior != null ? prior : T.baselineBetweenProb;
      });
      const total = weights.reduce((a, b) => a + b, 0);
      const cum = [];
      let acc = 0;
      for (const w of weights) { acc += w / total; cum.push(acc); }
      return cum;
    });

    // First pass: count out-degree per neuron (Poisson-ish around density).
    const offsets = new Uint32Array(n + 1);
    const r0 = rng.fork(7);
    let m = 0;
    for (let i = 0; i < n; i++) {
      let deg = Math.max(1, Math.round(density * (0.5 + r0.random())));
      // LongRange "shortcut" cells (Von Economo, Principle: shortcut highways)
      // get extra long-distance out-degree.
      if (regions[populations.region[i]].name === 'LongRange') deg = Math.round(deg * 1.5);
      offsets[i + 1] = deg;
      m += deg;
    }
    for (let i = 0; i < n; i++) offsets[i + 1] += offsets[i];

    syn.m = m;
    syn.offsets = offsets;
    syn.post = new Uint32Array(m);
    syn.weight = new Float32Array(m);
    syn.delay = new Uint8Array(m);
    syn.elig = new Float32Array(m);

    // Second pass: realise synapses.
    const r1 = rng.fork(11);
    for (let i = 0; i < n; i++) {
      const srcRegion = populations.region[i];
      const cum = dists[srcRegion];
      const isLong = regions[srcRegion].name === 'LongRange';
      const exc = populations.type[i] === TYPE_E;
      for (let k = offsets[i]; k < offsets[i + 1]; k++) {
        // Choose target region.
        let ri;
        if (isLong) {
          // Shortcut cells preferentially wire distant high-degree regions.
          const pref = ['PFC', 'Hippocampus', 'IntrinsicNets', 'V1', 'A1'];
          ri = regionByName[pref[r1.int(pref.length)]].index;
        } else {
          const x = r1.random();
          ri = 0;
          while (ri < cum.length - 1 && x > cum[ri]) ri++;
        }
        const reg = regions[ri];
        let target = reg.start + r1.int(reg.count);
        if (target === i) target = (target + 1) % n; // no self-synapse
        syn.post[k] = target;
        // Weight ~ |N(0, std)| with Dale's-Law sign.
        let w = Math.abs(r1.normal(0, T.weightInitStd));
        w = exc ? Math.min(w, T.wMax) : -Math.min(w, -T.wMin);
        syn.weight[k] = w;
        // Delay: longer for cross-region, scaled by distance proxy.
        const cross = ri !== srcRegion;
        syn.delay[k] = 1 + r1.int(cross ? MAX_DELAY - 1 : 3);
      }
    }

    syn.buildReverseIndex();
    syn.ring = new Float32Array(MAX_DELAY * n);
    return syn;
  }

  // Counting-sort the forward synapses by postsynaptic neuron to obtain the
  // reverse adjacency needed for exact post-spike-driven STDP potentiation.
  buildReverseIndex() {
    const { n, m, post } = this;
    const inOffsets = new Uint32Array(n + 1);
    for (let k = 0; k < m; k++) inOffsets[post[k] + 1]++;
    for (let i = 0; i < n; i++) inOffsets[i + 1] += inOffsets[i];
    const cursor = Uint32Array.from(inOffsets);
    const inIdx = new Uint32Array(m);
    for (let k = 0; k < m; k++) {
      const j = post[k];
      inIdx[cursor[j]++] = k;
    }
    this.inOffsets = inOffsets;
    this.inIdx = inIdx;
  }

  // Deliver spikes from neurons that fired this tick into the delay ring.
  propagate(populations, tick) {
    const { offsets, post, weight, delay, ring, n } = this;
    const spike = populations.spike;
    for (let i = 0; i < n; i++) {
      if (!spike[i]) continue;
      const end = offsets[i + 1];
      for (let k = offsets[i]; k < end; k++) {
        const slot = ((tick + delay[k]) % MAX_DELAY) * n + post[k];
        ring[slot] += weight[k];
      }
    }
  }

  // Drain this tick's slot of the delay ring into neuron input currents.
  deliver(populations, tick, gain) {
    const base = (tick % MAX_DELAY) * this.n;
    const ring = this.ring;
    const current = populations.current;
    const g = gain != null ? gain : 1;
    for (let j = 0; j < this.n; j++) {
      current[j] += ring[base + j] * g;
      ring[base + j] = 0;
    }
  }

  // Trace-based online STDP + eligibility accumulation.
  // Principle 1 (STDP fine-tuning) and Principle 18 (bounded, sparse weights).
  stdp(populations, plasticityMult, T) {
    const { offsets, post, weight, elig, inOffsets, inIdx } = this;
    const trace = populations.trace;
    const spike = populations.spike;
    const type = populations.type;
    const Aplus = T.stdpAplus * plasticityMult;
    const Aminus = T.stdpAminus * plasticityMult;

    for (let i = 0; i < this.n; i++) {
      if (!spike[i]) continue;
      // Pre-spike: depression vs. recently-active post neurons (post before pre).
      const end = offsets[i + 1];
      const exc = type[i] === TYPE_E;
      for (let k = offsets[i]; k < end; k++) {
        const dw = -Aminus * trace[post[k]];
        this.applyDw(k, dw, exc, T);
      }
      // Post-spike: potentiation from recently-active pre neurons (pre before post).
      const inEnd = inOffsets[i + 1];
      for (let p = inOffsets[i]; p < inEnd; p++) {
        const k = inIdx[p];
        const pre = this.preOf(k);
        const dw = Aplus * trace[pre];
        this.applyDw(k, dw, type[pre] === TYPE_E, T);
      }
    }
    // Eligibility decays each call.
    for (let k = 0; k < this.m; k++) elig[k] *= 0.99;
  }

  applyDw(k, dw, exc, T) {
    this.elig[k] += dw;
    let w = this.weight[k] + dw;
    // Clamp respecting Dale's Law sign.
    if (exc) w = w < 0 ? 0 : (w > T.wMax ? T.wMax : w);
    else w = w > 0 ? 0 : (w < T.wMin ? T.wMin : w);
    this.weight[k] = w;
  }

  // Recover presynaptic neuron of forward-synapse k via binary search on offsets.
  preOf(k) {
    const off = this.offsets;
    let lo = 0;
    let hi = this.n;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (off[mid + 1] <= k) lo = mid + 1; else hi = mid;
    }
    return lo;
  }

  // Principle 5: dopamine (RPE) rescales recent eligibility traces into weights.
  applyReward(da, T) {
    const { weight, elig, m } = this;
    const g = da * 0.05;
    for (let k = 0; k < m; k++) {
      let w = weight[k] + g * elig[k];
      if (w > T.wMax) w = T.wMax; else if (w < T.wMin) w = T.wMin;
      weight[k] = w;
    }
  }

  // Mean absolute excitatory vs inhibitory weight — used by the E/I monitor.
  weightStats(populations) {
    let eSum = 0;
    let iSum = 0;
    let eN = 0;
    let iN = 0;
    const step = Math.max(1, Math.floor(this.m / 200000)); // sample at scale
    for (let i = 0; i < this.n; i += 1) {
      const exc = populations.type[i] === TYPE_E;
      for (let k = this.offsets[i]; k < this.offsets[i + 1]; k += step) {
        const w = Math.abs(this.weight[k]);
        if (exc) { eSum += w; eN++; } else { iSum += w; iN++; }
      }
    }
    return {
      meanE: eN ? eSum / eN : 0,
      meanI: iN ? iSum / iN : 0,
    };
  }
}

module.exports = { Synapses, MAX_DELAY };
