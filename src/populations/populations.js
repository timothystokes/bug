'use strict';

// Principle 1 (E/I balance) + 13 (Dale's Law) substrate.
// Principle 13 also: every unit is strictly excitatory or inhibitory.
//
// Izhikevich cell classes. E population: RS / IB. I population: FS / LTS.
const CELL_CLASSES = [
  { name: 'RS', a: 0.02, b: 0.2, c: -65, d: 8, exc: true },   // 0 regular spiking
  { name: 'IB', a: 0.02, b: 0.2, c: -55, d: 4, exc: true },   // 1 intrinsic bursting
  { name: 'FS', a: 0.1, b: 0.2, c: -65, d: 2, exc: false },   // 2 fast spiking
  { name: 'LTS', a: 0.02, b: 0.25, c: -65, d: 2, exc: false }, // 3 low-threshold spiking
];

const TYPE_E = 0;
const TYPE_I = 1;
const V_THRESH = 30;

class Populations {
  constructor(n) {
    this.n = n;
    // Izhikevich membrane state.
    this.v = new Float32Array(n);
    this.u = new Float32Array(n);
    // Per-neuron Izhikevich parameters (kept explicit for dendritic variation).
    this.a = new Float32Array(n);
    this.b = new Float32Array(n);
    this.c = new Float32Array(n);
    this.d = new Float32Array(n);
    // Identity.
    this.type = new Uint8Array(n);      // TYPE_E / TYPE_I (Dale's Law)
    this.cellClass = new Uint8Array(n);  // index into CELL_CLASSES
    this.region = new Uint16Array(n);
    // Dynamic per-tick state.
    this.current = new Float32Array(n);  // synaptic + sensory input this tick
    this.spike = new Uint8Array(n);      // fired this tick (1/0)
    this.lastSpike = new Int32Array(n);  // tick index of last spike
    this.trace = new Float32Array(n);    // STDP presyn trace / activity trace
    this.rate = new Float32Array(n);     // slow firing-rate estimate
  }

  // Birth-time cell-type assignment per Dale's Law and region E:I ratio.
  init(config, rng) {
    for (const region of config.regions) {
      const r = rng.fork(region.index + 1);
      for (let i = region.start; i < region.end; i++) {
        this.region[i] = region.index;
        const isExc = r.random() < region.eiRatio;
        let cls;
        if (isExc) {
          this.type[i] = TYPE_E;
          cls = r.random() < 0.2 ? 1 : 0; // some IB among RS
        } else {
          this.type[i] = TYPE_I;
          cls = r.random() < 0.5 ? 2 : 3; // FS / LTS
        }
        this.cellClass[i] = cls;
        const cc = CELL_CLASSES[cls];
        // Small per-cell jitter -> heterogeneous dynamics.
        this.a[i] = cc.a * (1 + r.normal(0, 0.05));
        this.b[i] = cc.b * (1 + r.normal(0, 0.05));
        this.c[i] = cc.c;
        this.d[i] = cc.d;
        this.v[i] = cc.c;
        this.u[i] = cc.b * cc.c;
        this.lastSpike[i] = -1000000;
      }
    }
  }

  // One Izhikevich integration step over all neurons.
  // dt in ms-analogue (1.0). Records spikes into this.spike and updates traces.
  step(tick, traceDecay) {
    const { v, u, a, b, c, d, current, spike, lastSpike, trace, rate } = this;
    let spikes = 0;
    for (let i = 0; i < this.n; i++) {
      let vi = v[i];
      const ui = u[i];
      const I = current[i];
      // Two 0.5ms sub-steps for numerical stability (standard Izhikevich trick).
      vi += 0.5 * (0.04 * vi * vi + 5 * vi + 140 - ui + I);
      vi += 0.5 * (0.04 * vi * vi + 5 * vi + 140 - ui + I);
      let uu = ui + a[i] * (b[i] * vi - ui);
      let fired = 0;
      if (vi >= V_THRESH) {
        vi = c[i];
        uu += d[i];
        fired = 1;
        lastSpike[i] = tick;
        spikes++;
      }
      v[i] = vi;
      u[i] = uu;
      spike[i] = fired;
      // Pre-synaptic / activity trace with exponential decay.
      trace[i] = trace[i] * traceDecay + fired;
      rate[i] = rate[i] * 0.99 + fired * 0.01;
    }
    return spikes;
  }

  clearCurrent() {
    this.current.fill(0);
  }

  isExcitatory(i) {
    return this.type[i] === TYPE_E;
  }
}

module.exports = { Populations, CELL_CLASSES, TYPE_E, TYPE_I, V_THRESH };
