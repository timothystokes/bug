'use strict';

// Deterministic, seedable PRNG (mulberry32). Cheap, good enough for a brain sim
// and — crucially — reproducible so the genome seed yields the same individual.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class RNG {
  constructor(seed) {
    this.seed = seed >>> 0;
    this._a = this.seed; // internal mutable state (persisted for exact resume)
  }

  // Uniform [0,1)
  random() {
    let a = this._a | 0;
    a = (a + 0x6d2b79f5) | 0;
    this._a = a;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Capture / restore internal state for exact persistence.
  getState() { return this._a >>> 0; }
  setState(a) { this._a = a >>> 0; }

  // Uniform [min,max)
  uniform(min, max) {
    return min + (max - min) * this.random();
  }

  // Integer [0,n)
  int(n) {
    return Math.floor(this.random() * n);
  }

  // Standard normal via Box-Muller.
  normal(mean = 0, std = 1) {
    let u = 0;
    let v = 0;
    while (u === 0) u = this.random();
    while (v === 0) v = this.random();
    const mag = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return mean + std * mag;
  }

  // Bernoulli trial.
  chance(p) {
    return this.random() < p;
  }

  // Fork an independent stream deterministically.
  fork(salt) {
    return new RNG((this.seed ^ (Math.imul(salt + 1, 0x9e3779b1))) >>> 0);
  }
}

module.exports = { RNG, mulberry32 };
