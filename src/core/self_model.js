'use strict';

// Principle 12: Behaviour-coupled learning / closed action-perception loop. The
// brain models its own outputs and their downstream effects on inputs, so
// learning is driven by the brain-behaviour loop, not just passive observation.
// Source: Mathis & Mathis (2026) joint brain-behaviour modelling.
class SelfModel {
  constructor() {
    this.predictedNext = null; // predicted next sensory vector after own action
    this.lastAction = null;
    this.selfPredictionError = 1.0;
    // Simple learned association: action symbol -> expected next input vector.
    this.assoc = new Map();
  }

  // Record an action and predict its sensory consequence.
  predictConsequence(action) {
    this.lastAction = action;
    if (!action) { this.predictedNext = null; return; }
    this.predictedNext = this.assoc.get(action.symbolIndex) || null;
  }

  // Compare the actual next sensory packet to the prediction; learn the mapping
  // and return the self-prediction error (an intrinsic reward signal).
  observeConsequence(actualVector) {
    if (!this.lastAction || !actualVector) return 0;
    const key = this.lastAction.symbolIndex;
    let pred = this.assoc.get(key);
    if (!pred) { pred = new Float32Array(actualVector.length); this.assoc.set(key, pred); }
    let err = 0;
    for (let i = 0; i < actualVector.length; i++) {
      const d = actualVector[i] - pred[i];
      err += d * d;
      pred[i] += 0.1 * d; // learn the action->consequence mapping
    }
    err = Math.sqrt(err / actualVector.length);
    this.selfPredictionError = 0.95 * this.selfPredictionError + 0.05 * err;
    return err;
  }

  toJSON() {
    return {
      selfPredictionError: this.selfPredictionError,
      assoc: Array.from(this.assoc.entries()).map(([k, v]) => [k, Array.from(v)]),
    };
  }

  load(obj) {
    if (!obj) return;
    this.selfPredictionError = obj.selfPredictionError != null ? obj.selfPredictionError : 1.0;
    this.assoc = new Map((obj.assoc || []).map(([k, v]) => [k, Float32Array.from(v)]));
  }
}

module.exports = { SelfModel };
