'use strict';

const snapshot = require('../persist/snapshot');
const log = require('../util/log').make('runner');

// Multi-rate scheduler. Runs the fast neural tick in time-bounded batches via
// setImmediate so the event loop is never blocked for >~50ms (README
// "Concurrency"). Slow clocks (neuromod / epigenetic) are handled inside
// Brain.tick via tick counters. Periodic snapshots happen on a tick cadence.
class Runner {
  constructor(brain, opts = {}) {
    this.brain = brain;
    this.stateDir = opts.stateDir || brain.config.stateDir;
    this.batchMs = opts.batchMs || 20;          // wall-time budget per batch
    this.maxBatch = opts.maxBatch || 5000;      // safety cap on ticks per batch
    this.running = false;
    this.lastSnapshotMs = Date.now();
    this.snapshotEveryMs = opts.snapshotEveryMs || 60000; // wall-clock cadence
    this.onBatch = opts.onBatch || null;

    // Real-time pacing. realtimeFactor=1.0 means 1 sim-second per wall-second.
    // 0 / null / Infinity means "run as fast as possible" (training mode).
    // For interactive CLI we cap to a sane rate so the brain doesn't burn a
    // sim-day in 30 s of idle terminal.
    const ticksPerSimSec = (brain.config.tunables.ticksPerSimDay || 50000) / 86400;
    this.realtimeFactor = opts.realtimeFactor != null ? opts.realtimeFactor : 1.0;
    this.targetTicksPerSec = (this.realtimeFactor > 0 && isFinite(this.realtimeFactor))
      ? ticksPerSimSec * this.realtimeFactor
      : Infinity;
    this.tickDebt = 0;
    this.lastPaceMs = Date.now();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._loop();
  }

  stop() {
    this.running = false;
  }

  _loop() {
    if (!this.running) return;
    const start = Date.now();

    // Compute how many ticks we're allowed to run this batch under the pacing cap.
    let allowance = this.maxBatch;
    if (isFinite(this.targetTicksPerSec)) {
      const dtMs = start - this.lastPaceMs;
      this.lastPaceMs = start;
      this.tickDebt += (this.targetTicksPerSec * dtMs) / 1000;
      allowance = Math.max(0, Math.floor(this.tickDebt));
    }

    let ticks = 0;
    while (this.running && ticks < Math.min(this.maxBatch, allowance) && (Date.now() - start) < this.batchMs) {
      this.brain.tick();
      ticks++;
    }
    if (isFinite(this.targetTicksPerSec)) this.tickDebt -= ticks;

    if (Date.now() - this.lastSnapshotMs >= this.snapshotEveryMs) {
      this.lastSnapshotMs = Date.now();
      try { snapshot.save(this.brain, this.stateDir); } catch (e) { log.error(`snapshot failed: ${e.message}`); }
    }
    if (this.onBatch) this.onBatch(ticks);

    // Sleep until the next tick is due (under pacing) so we yield CPU.
    if (isFinite(this.targetTicksPerSec) && this.tickDebt < 1) {
      const waitMs = Math.max(5, Math.floor(1000 / Math.max(1, this.targetTicksPerSec)));
      setTimeout(() => this._loop(), waitMs);
    } else {
      setImmediate(() => this._loop());
    }
  }

  // Run synchronously for a fixed number of ticks (used by the trainer), yielding
  // to the event loop periodically so timers/IO still fire.
  async runTicks(nTicks, onProgress) {
    let done = 0;
    while (done < nTicks) {
      const start = Date.now();
      while (done < nTicks && (Date.now() - start) < 50) {
        this.brain.tick();
        done++;
      }
      if (onProgress) onProgress(done);
      await new Promise((r) => setImmediate(r));
    }
  }

  save() {
    snapshot.save(this.brain, this.stateDir);
    this.lastSnapshotMs = Date.now();
  }
}

module.exports = { Runner };
