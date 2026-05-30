'use strict';

// Motor channels. Principle 9 (embodied I/O) + Principle 12 (behaviour-coupled
// learning / closed action-perception loop).
//
// Phase-1 motor: reads Motor-cortex activity and emits a "vocalisation" token to
// stdout. The act of writing is itself a tactile signal the brain can "feel"
// (the README treats stdout as the touch channel), so the emission is fed back
// as a consequence for self-modelling.
const ALPHABET = ' abcdefghijklmnopqrstuvwxyz.!?';

class StdoutMotor {
  constructor(config) {
    this.config = config;
    this.region = config.regions.find((r) => r.name === 'Motor');
    this.lastEmission = null;
    this.emissionCount = 0;
    this.silent = false; // when true, do not print (used during fast training)
  }

  // Read motor activity, pick an output symbol (argmax over slabs), emit it.
  // Exploration (noradrenaline/dopamine) injects stochasticity. Returns the
  // emitted token (the consequence) for the closed loop, or null if quiet.
  act(populations, explorationDrive, rng) {
    if (!this.region) return null;
    const r = this.region;
    const nSym = ALPHABET.length;
    const slab = Math.max(1, Math.floor(r.count / nSym));
    let best = 0;
    let bestVal = -Infinity;
    let total = 0;
    for (let s = 0; s < nSym; s++) {
      let sum = 0;
      const base = r.start + s * slab;
      const end = Math.min(r.end, base + slab);
      for (let i = base; i < end; i++) sum += populations.rate[i];
      total += sum;
      if (sum > bestVal) { bestVal = sum; best = s; }
    }
    if (total < 1e-4) return null; // motor cortex quiet -> no vocalisation
    // Exploration: sometimes emit a random symbol.
    if (rng && rng.random() < explorationDrive * 0.5) best = rng.int(nSym);
    const token = ALPHABET[best];
    this.lastEmission = token;
    this.emissionCount++;
    if (!this.silent) process.stdout.write(token === ' ' ? '' : '');
    return { token, symbolIndex: best };
  }

  toJSON() {
    return { emissionCount: this.emissionCount, lastEmission: this.lastEmission };
  }

  load(obj) {
    if (!obj) return;
    this.emissionCount = obj.emissionCount || 0;
    this.lastEmission = obj.lastEmission || null;
  }
}

// Phase-3 speaker motor: motor spikes -> simple vocoder. Stubbed (no audio out).
class SpeakerMotor {
  constructor() {
    this.enabled = false; // TODO: real speaker output via vocoder
    this.buffer = [];
  }

  enable() { this.enabled = true; }

  emit(symbolIndex) {
    if (!this.enabled) return;
    // TODO: synthesise audio. For now record a fake vocoder frame.
    this.buffer.push(symbolIndex);
    if (this.buffer.length > 100) this.buffer.shift();
  }
}

module.exports = { StdoutMotor, SpeakerMotor, ALPHABET };
