'use strict';

const { FEATURE_DIM } = require('./text_sensor');

// Sensor phases 2-4 scaffolding (README "Sensors: phased rollout").
// The channel interfaces are real and plug into the thalamic two-system router;
// the actual hardware capture is stubbed with a deterministic fake-input
// generator so the whole pipeline can be exercised before drivers exist.

// Phase 2: Microphone -> 64-band cochlea filterbank -> ~100Hz spectral frames.
class MicrophoneSensor {
  constructor() {
    this.modality = 'audio';
    this.targetRegion = 'A1';
    this.enabled = false; // TODO: real 16kHz mono capture
    this.t = 0;
  }

  enable() { this.enabled = true; }

  // FAKE INPUT: synthesises a moving spectral peak (a "chirp").
  pull() {
    if (!this.enabled) return null;
    this.t++;
    const vec = new Float32Array(FEATURE_DIM);
    const peak = (Math.sin(this.t * 0.02) * 0.5 + 0.5) * (FEATURE_DIM - 1);
    for (let i = 0; i < FEATURE_DIM; i++) {
      vec[i] = Math.exp(-((i - peak) ** 2) / 8);
    }
    return { modality: this.modality, token: `tone:${Math.round(peak)}`, vector: vec, targetRegion: this.targetRegion };
  }

  hasInput() { return this.enabled; }
}

// Phase 4: Camera -> 320x240 grayscale @10fps -> V1 Gabor pyramid.
class CameraSensor {
  constructor() {
    this.modality = 'vision';
    this.targetRegion = 'V1';
    this.enabled = false; // TODO: real camera capture
    this.t = 0;
  }

  enable() { this.enabled = true; }

  // FAKE INPUT: synthesises drifting oriented-edge (Gabor) energy.
  pull() {
    if (!this.enabled) return null;
    this.t++;
    const vec = new Float32Array(FEATURE_DIM);
    for (let i = 0; i < FEATURE_DIM; i++) {
      const theta = (i / FEATURE_DIM) * Math.PI;
      vec[i] = Math.abs(Math.cos(theta * 2 + this.t * 0.05));
    }
    return { modality: this.modality, token: 'frame', vector: vec, targetRegion: this.targetRegion };
  }

  hasInput() { return this.enabled; }
}

module.exports = { MicrophoneSensor, CameraSensor };
