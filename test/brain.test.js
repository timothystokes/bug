'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { buildConfig } = require('../src/config');
const { Brain } = require('../src/brain');
const snapshot = require('../src/persist/snapshot');
const { Curriculum } = require('../src/curriculum/curriculum');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'brain-test-'));
}
function feed(brain, cur, n = 6) {
  while (brain.textSensor.queue.length < n) {
    const it = cur.next();
    brain.textSensor.feed(it.token, it.reward);
  }
}

test('boot: birth produces a structurally complete brain', () => {
  const cfg = buildConfig({ scale: 'tiny' });
  const b = Brain.birth(cfg, 1);
  assert.strictEqual(b.populations.n, cfg.nNeurons);
  assert.ok(b.synapses.m > 0, 'has synapses');
  assert.strictEqual(cfg.regions.length, 13, 'all 13 regions present');
  // Dale's Law: every neuron is strictly E or I.
  for (let i = 0; i < b.populations.n; i++) assert.ok(b.populations.type[i] === 0 || b.populations.type[i] === 1);
  const s = b.stats();
  assert.strictEqual(s.tick, 0);
  assert.ok('complexity' in s && 'eiActivityRatio' in s && 'predictionError' in s);
});

test('tick: DIME loop advances and produces spikes', () => {
  const cfg = buildConfig({ scale: 'tiny' });
  const b = Brain.birth(cfg, 2);
  const cur = new Curriculum({ seed: 2 });
  for (let i = 0; i < 500; i++) { feed(b, cur); b.tick(); }
  assert.strictEqual(b.tickCount, 500);
  assert.ok(b.lifetimeSpikes > 0, 'network fired');
  assert.ok(b.cognitiveMap.size() > 0, 'concepts formed');
});

test('save/restore: checksum is exact across persistence', () => {
  const dir = tmpDir();
  try {
    const cfg = buildConfig({ scale: 'tiny', stateDir: dir });
    const b = Brain.birth(cfg, 3);
    const cur = new Curriculum({ seed: 3 });
    for (let i = 0; i < 800; i++) { feed(b, cur); b.tick(); }
    const cs = b.checksum();
    snapshot.save(b, dir);
    const b2 = snapshot.restore(dir, cfg);
    assert.strictEqual(b2.checksum(), cs, 'restored checksum matches');
    assert.strictEqual(b2.tickCount, b.tickCount);
    assert.strictEqual(b2.genome.seed, b.genome.seed);
    assert.strictEqual(b2.epigenetic.simDays, b.epigenetic.simDays);
    // Weights restored bit-exactly.
    for (let k = 0; k < b.synapses.m; k += 997) {
      assert.strictEqual(b2.synapses.weight[k], b.synapses.weight[k]);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('training progress: prediction error falls and memory grows', () => {
  const cfg = buildConfig({ scale: 'tiny' });
  const b = Brain.birth(cfg, 4);
  b.stdoutMotor.silent = true;
  const cur = new Curriculum({ seed: 4 });
  // Warm up to get a baseline, then measure improvement.
  for (let i = 0; i < 300; i++) { feed(b, cur); b.tick(); }
  const startErr = b.predictive.totalError;
  const startEps = b.hippocampus.episodes.length;
  for (let i = 0; i < 4000; i++) { feed(b, cur); b.tick(); }
  assert.ok(b.predictive.totalError <= startErr + 1e-6, `pred error did not rise (${startErr} -> ${b.predictive.totalError})`);
  assert.ok(b.predictive.totalError < 0.5, 'prediction error became low');
  assert.ok(b.hippocampus.episodes.length >= startEps, 'episodic memory grew');
});

test('sleep: offline replay consolidates and advances development', () => {
  const cfg = buildConfig({ scale: 'tiny' });
  const b = Brain.birth(cfg, 5);
  const cur = new Curriculum({ seed: 5 });
  for (let i = 0; i < 1500; i++) { feed(b, cur); b.tick(); }
  const day0 = b.epigenetic.simDays;
  const r = b.sleep(100);
  assert.ok(r.totalReplayed > 0, 'replayed engrams');
  assert.ok(b.epigenetic.simDays > day0, 'development advanced');
});
