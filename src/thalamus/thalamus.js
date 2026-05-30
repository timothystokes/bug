'use strict';

// Principle 4: Two-system sensory routing. Every input is dispatched along two
// paths: a content-preserving *lemniscal* path (modality-specific, projects to
// the cortical region) and a diffuse *extralemniscal* salience path (signals
// "something happened", broadcast widely), so novel/sudden inputs trigger global
// state changes even when their content is weak.
class Thalamus {
  constructor(config) {
    this.config = config;
    this.prevEnergy = {}; // per-modality previous input energy, for onset/salience
  }

  // input: { modality, vector:Float32Array, targetRegion } from a sensor.
  // Returns { content, salience } and injects current into populations.
  route(input, populations, neuromods) {
    const region = this.config.regions.find((r) => r.name === input.targetRegion);
    if (!region) return { content: 0, salience: 0 };

    const vec = input.vector;
    let energy = 0;
    for (let i = 0; i < vec.length; i++) energy += vec[i] * vec[i];
    energy = Math.sqrt(energy);

    // Lemniscal: map the vector across the target region's neurons (content).
    const span = region.count;
    const drive = neuromods ? neuromods.gain() : 1.0;
    for (let i = 0; i < vec.length; i++) {
      // Spread each feature across a contiguous slab of the region.
      const slab = Math.max(1, Math.floor(span / vec.length));
      const base = region.start + (i * slab) % span;
      for (let s = 0; s < slab; s++) {
        populations.current[base + s] += vec[i] * 18.0 * drive;
      }
    }

    // Extralemniscal: salience = onset (change in energy). Broadcast diffusely.
    const prev = this.prevEnergy[input.modality] || 0;
    const salience = Math.abs(energy - prev);
    this.prevEnergy[input.modality] = energy;
    if (salience > 0.01) {
      // Diffuse light excitation across Brainstem + IntrinsicNets (alerting).
      this.broadcast(populations, 'Brainstem', salience * 2);
      this.broadcast(populations, 'IntrinsicNets', salience * 1.5);
    }
    return { content: energy, salience };
  }

  broadcast(populations, regionName, amount) {
    const region = this.config.regions.find((r) => r.name === regionName);
    if (!region) return;
    const step = Math.max(1, Math.floor(region.count / 64));
    for (let i = region.start; i < region.end; i += step) {
      populations.current[i] += amount;
    }
  }

  toJSON() { return { prevEnergy: this.prevEnergy }; }

  load(obj) { if (obj && obj.prevEnergy) this.prevEnergy = obj.prevEnergy; }
}

module.exports = { Thalamus };
