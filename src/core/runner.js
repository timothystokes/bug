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
    this.lastSnapshotTick = brain.tickCount;
    this.onBatch = opts.onBatch || null;
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
    let ticks = 0;
    while (this.running && ticks < this.maxBatch && (Date.now() - start) < this.batchMs) {
      this.brain.tick();
      ticks++;
    }
    // Periodic snapshot on a tick cadence.
    const cadence = this.brain.config.tunables.snapshotEveryTicks;
    if (this.brain.tickCount - this.lastSnapshotTick >= cadence) {
      this.lastSnapshotTick = this.brain.tickCount;
      try { snapshot.save(this.brain, this.stateDir); } catch (e) { log.error(`snapshot failed: ${e.message}`); }
    }
    if (this.onBatch) this.onBatch(ticks);
    setImmediate(() => this._loop());
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
    this.lastSnapshotTick = this.brain.tickCount;
  }
}

module.exports = { Runner };
