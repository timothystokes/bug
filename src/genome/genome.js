'use strict';

const { RNG } = require('../util/rng');

// Principle 11: Genetics x environment. A small immutable "genome" of initial
// parameters is frozen at birth and constrains the decisional space for life.
class Genome {
  constructor(data) {
    this.seed = data.seed;
    this.birthTimestamp = data.birthTimestamp;
    // Macro parameters drawn once from the seed; never change afterwards.
    this.eiRatioBias = data.eiRatioBias;
    this.explorationBaseline = data.explorationBaseline;
    this.plasticityDecay = data.plasticityDecay;
    this.neuromodSetpointBias = data.neuromodSetpointBias;
    this.curiosityGain = data.curiosityGain;
    Object.freeze(this);
    Object.freeze(this.neuromodSetpointBias);
  }

  // Create a fresh genome from a master seed. This is "conception".
  static conceive(seed) {
    const rng = new RNG(seed);
    return new Genome({
      seed,
      birthTimestamp: Date.now(),
      eiRatioBias: rng.uniform(-0.03, 0.03),
      explorationBaseline: rng.uniform(0.1, 0.3),
      plasticityDecay: rng.uniform(0.9990, 0.9999),
      curiosityGain: rng.uniform(0.5, 1.5),
      neuromodSetpointBias: {
        da: rng.uniform(-0.05, 0.05),
        serotonin: rng.uniform(-0.05, 0.05),
        ne: rng.uniform(-0.05, 0.05),
        ach: rng.uniform(-0.05, 0.05),
        cortisol: rng.uniform(-0.05, 0.05),
      },
    });
  }

  static fromJSON(obj) {
    return new Genome(obj);
  }

  toJSON() {
    return {
      seed: this.seed,
      birthTimestamp: this.birthTimestamp,
      eiRatioBias: this.eiRatioBias,
      explorationBaseline: this.explorationBaseline,
      plasticityDecay: this.plasticityDecay,
      curiosityGain: this.curiosityGain,
      neuromodSetpointBias: this.neuromodSetpointBias,
    };
  }
}

module.exports = { Genome };
