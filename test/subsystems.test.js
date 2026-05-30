'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const { buildConfig } = require('../src/config');
const { RNG } = require('../src/util/rng');
const { Genome } = require('../src/genome/genome');
const { Hippocampus } = require('../src/hippocampus/hippocampus');
const { CognitiveMap } = require('../src/cognitive_map/cognitive_map');
const { Neuromodulators } = require('../src/modulators/neuromodulators');

test('rng: deterministic and state-restorable', () => {
  const a = new RNG(123);
  const seq = [a.random(), a.random(), a.random()];
  const b = new RNG(123);
  assert.deepStrictEqual([b.random(), b.random(), b.random()], seq);
  // State capture/restore reproduces the stream.
  const c = new RNG(999);
  c.random(); c.random();
  const st = c.getState();
  const next = c.random();
  const d = new RNG(0);
  d.setState(st);
  assert.strictEqual(d.random(), next);
});

test('genome: immutable identity from seed', () => {
  const g = Genome.conceive(77);
  assert.throws(() => { g.explorationBaseline = 1; }, 'genome is frozen');
  const g2 = Genome.fromJSON(g.toJSON());
  assert.strictEqual(g2.seed, g.seed);
  assert.strictEqual(g2.plasticityDecay, g.plasticityDecay);
});

test('hippocampus: pattern separation is sparse and completion retrieves', () => {
  const cfg = buildConfig({ scale: 'tiny' });
  const hip = new Hippocampus(cfg, Genome.conceive(1));
  const vec = new Float32Array(hip.inDim).map(() => Math.random());
  const code = hip.separate(vec);
  assert.strictEqual(code.length, hip.k, 'k-WTA sparse code');
  assert.ok(hip.k < hip.codeDim, 'code is sparse vs expansion dim');
  // A near-identical cue should pattern-complete to a stored episode.
  hip.episodes.push({ id: 1, active: code, modalities: ['text'], salience: 1, tick: 0, replays: 0 });
  const res = hip.complete(code);
  assert.ok(res && res.episode.id === 1 && res.match === 1, 'completes from full cue');
});

test('cognitive map: relational analogy works', () => {
  const m = new CognitiveMap();
  ['king', 'queen', 'man', 'woman'].forEach((t) => m.observe(t));
  const ans = m.analogy('king', 'queen', 'man');
  assert.ok(typeof ans === 'string', 'analogy returns a concept');
});

test('neuromodulators: RPE moves dopamine, homeostasis relaxes', () => {
  const nm = new Neuromodulators(Genome.conceive(2));
  nm.rewardPredictionError(1.0); // positive surprise
  assert.ok(nm.level.da > 0.5, 'dopamine rises on positive RPE');
  for (let i = 0; i < 200; i++) nm.relax();
  assert.ok(Math.abs(nm.level.da - nm.setpoints.da) < 0.05, 'relaxes toward set-point');
});
