'use strict';

// Principle 9: Embodied I/O. Sensory channels are constitutive of cognition.
// Encodes a value into a fixed-width feature vector for the thalamic router.
const FEATURE_DIM = 32;

function encodeText(text) {
  // Bag-of-character-hash features + simple positional structure, normalised.
  const vec = new Float32Array(FEATURE_DIM);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    vec[code % FEATURE_DIM] += 1;
    vec[(code * 7 + i) % FEATURE_DIM] += 0.5; // weak positional component
  }
  // L2 normalise.
  let norm = 0;
  for (let i = 0; i < FEATURE_DIM; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < FEATURE_DIM; i++) vec[i] /= norm;
  return vec;
}

// Phase-1 somatic/keyboard channel (stdin). Buffers incoming text and emits one
// token per pull as a routed sensory packet.
class TextSensor {
  constructor() {
    this.modality = 'text';
    this.targetRegion = 'Somatosensory'; // stdin = proprio/interoceptive
    this.queue = [];
    this.lastToken = null;
  }

  feed(token, reward) {
    this.queue.push({ token, reward: reward != null ? reward : 0 });
  }

  // Returns the next sensory packet, or null if idle.
  pull() {
    if (this.queue.length === 0) return null;
    const item = this.queue.shift();
    this.lastToken = item.token;
    return { modality: this.modality, token: item.token, vector: encodeText(item.token), targetRegion: this.targetRegion, reward: item.reward };
  }

  hasInput() { return this.queue.length > 0; }

  toJSON() { return { queue: this.queue, lastToken: this.lastToken }; }

  load(obj) {
    if (!obj) return;
    this.queue = obj.queue || [];
    this.lastToken = obj.lastToken != null ? obj.lastToken : null;
  }
}

module.exports = { TextSensor, encodeText, FEATURE_DIM };
