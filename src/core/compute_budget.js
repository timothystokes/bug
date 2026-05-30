'use strict';

// Principle 19: Bounded compute budget per thought. Each inference step has an
// explicit budget in breadth x depth x recurrent steps, traded off against
// expected information gain — mirroring metabolic limits. Source: "Growing a
// Neural Network in Breadth, Depth, and Time" (2026).
class ComputeBudget {
  constructor(budget) {
    this.breadth = budget.breadth;            // max neurons considered per step
    this.depth = budget.depth;                // max hierarchical depth
    this.maxRecurrentSteps = budget.recurrentSteps;
    this.prevError = 1.0;
    this.spent = 0;
  }

  // Decide how many recurrent integrate sub-steps to run this tick, given the
  // expected information gain (drop in prediction error). High gain -> think
  // longer (up to the budget); diminishing returns -> stop early (save energy).
  recurrentSteps(currentError) {
    const gain = this.prevError - currentError; // positive = learning
    this.prevError = 0.9 * this.prevError + 0.1 * currentError;
    let steps = 1;
    if (gain > 0.001) steps = Math.min(this.maxRecurrentSteps, 1 + Math.ceil(gain * 1000));
    this.spent += steps;
    return steps;
  }

  toJSON() {
    return { breadth: this.breadth, depth: this.depth, maxRecurrentSteps: this.maxRecurrentSteps, spent: this.spent, prevError: this.prevError };
  }

  load(obj) {
    if (!obj) return;
    this.spent = obj.spent || 0;
    if (obj.prevError != null) this.prevError = obj.prevError;
  }
}

module.exports = { ComputeBudget };
