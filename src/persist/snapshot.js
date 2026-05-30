'use strict';

const { ByteWriter, ByteReader, ensureDir, writeJSON, readJSON, exists, path } = require('./io');
const fs = require('fs');
const { Brain } = require('../brain');
const { Genome } = require('../genome/genome');
const { Populations } = require('../populations/populations');
const { Synapses, MAX_DELAY } = require('../synapses/synapses');
const { Glia } = require('../glia/glia');
const log = require('../util/log').make('persist');

// Persist the full brain to a structured on-disk store. Bulk numeric state is
// written as raw typed-array dumps (.bin); control-plane / metadata is JSON.
// Resume must be exact (README "Persistent state").
function save(brain, dir) {
  ensureDir(dir);
  const p = brain.populations;
  const s = brain.synapses;

  // Neurons (hot numeric state).
  const nw = new ByteWriter();
  nw.push(p.v); nw.push(p.u);
  nw.push(p.a); nw.push(p.b); nw.push(p.c); nw.push(p.d);
  nw.push(p.trace); nw.push(p.rate);
  nw.push(p.lastSpike);
  nw.push(p.type); nw.push(p.cellClass);
  nw.push(p.region);
  fs.writeFileSync(path.join(dir, 'neurons.bin'), nw.toBuffer());

  // Synapses (sparse store).
  const sw = new ByteWriter();
  sw.push(s.offsets);
  sw.push(s.post);
  sw.push(s.delay);
  sw.push(s.weight);
  sw.push(s.elig);
  fs.writeFileSync(path.join(dir, 'synapses.bin'), sw.toBuffer());

  // Glia + delay ring (transient but persisted for exact resume).
  fs.writeFileSync(path.join(dir, 'glia.bin'), Buffer.from(brain.glia.resource.buffer, 0, brain.glia.resource.byteLength));
  fs.writeFileSync(path.join(dir, 'ring.bin'), Buffer.from(s.ring.buffer, 0, s.ring.byteLength));

  // Control-plane / metadata.
  writeJSON(path.join(dir, 'genome.json'), brain.genome.toJSON());
  writeJSON(path.join(dir, 'meta.json'), {
    version: 1,
    scale: brain.config.scale,
    nNeurons: p.n,
    synapseDensity: brain.config.synapseDensity,
    m: s.m,
    maxDelay: MAX_DELAY,
    tickCount: brain.tickCount,
    lifetimeSpikes: brain.lifetimeSpikes,
    phase: brain.phase,
    glia: { pool: brain.glia.pool },
    neuromods: brain.neuromods.toJSON(),
    oscillators: brain.oscillators.toJSON(),
    monitor: brain.monitor.toJSON(),
    predictive: brain.predictive.toJSON(),
    hippocampus: brain.hippocampus.toJSON(),
    intrinsic: brain.intrinsic.toJSON(),
    workingMemory: brain.workingMemory.toJSON(),
    cognitiveMap: brain.cognitiveMap.toJSON(),
    epigenetic: brain.epigenetic.toJSON(),
    budget: brain.budget.toJSON(),
    selfModel: brain.selfModel.toJSON(),
    drives: brain.drives.toJSON(),
    stdoutMotor: brain.stdoutMotor.toJSON(),
    textSensor: brain.textSensor.toJSON(),
    thalamus: brain.thalamus.toJSON(),
    rngState: brain.rng.getState(),
    checksum: brain.checksum(),
  });
  log.info(`Saved snapshot to ${dir}/ (checksum ${brain.checksum()})`);
}

function restore(dir, config) {
  const meta = readJSON(path.join(dir, 'meta.json'));
  const genome = Genome.fromJSON(readJSON(path.join(dir, 'genome.json')));
  const n = meta.nNeurons;
  const m = meta.m;

  const brain = new Brain(config);
  brain.genome = genome;
  const { RNG } = require('../util/rng');
  brain.rng = new RNG(genome.seed ^ 0xa5a5a5a5);

  // Neurons.
  const p = new Populations(n);
  const nr = new ByteReader(fs.readFileSync(path.join(dir, 'neurons.bin')));
  p.v.set(nr.read(Float32Array, n));
  p.u.set(nr.read(Float32Array, n));
  p.a.set(nr.read(Float32Array, n));
  p.b.set(nr.read(Float32Array, n));
  p.c.set(nr.read(Float32Array, n));
  p.d.set(nr.read(Float32Array, n));
  p.trace.set(nr.read(Float32Array, n));
  p.rate.set(nr.read(Float32Array, n));
  p.lastSpike.set(nr.read(Int32Array, n));
  p.type.set(nr.read(Uint8Array, n));
  p.cellClass.set(nr.read(Uint8Array, n));
  p.region.set(nr.read(Uint16Array, n));
  brain.populations = p;

  // Synapses.
  const s = new Synapses();
  s.n = n; s.m = m;
  const sr = new ByteReader(fs.readFileSync(path.join(dir, 'synapses.bin')));
  s.offsets = sr.read(Uint32Array, n + 1);
  s.post = sr.read(Uint32Array, m);
  s.delay = sr.read(Uint8Array, m);
  s.weight = sr.read(Float32Array, m);
  s.elig = sr.read(Float32Array, m);
  s.buildReverseIndex();
  const ringData = fs.readFileSync(path.join(dir, 'ring.bin'));
  s.ring = new Float32Array(MAX_DELAY * n);
  s.ring.set(new Float32Array(ringData.buffer, ringData.byteOffset, MAX_DELAY * n));
  brain.synapses = s;

  // Glia.
  brain.glia = new Glia(n);
  const gliaData = fs.readFileSync(path.join(dir, 'glia.bin'));
  brain.glia.resource.set(new Float32Array(gliaData.buffer, gliaData.byteOffset, n));
  brain.glia.pool = meta.glia ? meta.glia.pool : 1.0;

  // Subsystems.
  brain._initSubsystems();
  brain.tickCount = meta.tickCount || 0;
  brain.lifetimeSpikes = meta.lifetimeSpikes || 0;
  brain.phase = meta.phase || 'wake';
  brain.neuromods.load(meta.neuromods);
  brain.oscillators.load(meta.oscillators);
  brain.monitor.load(meta.monitor);
  brain.predictive.load(meta.predictive);
  brain.hippocampus.load(meta.hippocampus);
  brain.intrinsic.load(meta.intrinsic);
  brain.workingMemory.load(meta.workingMemory);
  brain.cognitiveMap.load(meta.cognitiveMap);
  brain.epigenetic.load(meta.epigenetic);
  brain.budget.load(meta.budget);
  brain.selfModel.load(meta.selfModel);
  brain.drives.load(meta.drives);
  brain.stdoutMotor.load(meta.stdoutMotor);
  brain.textSensor.load(meta.textSensor);
  brain.thalamus.load(meta.thalamus);
  if (meta.rngState != null) brain.rng.setState(meta.rngState);

  log.info(`Restored snapshot from ${dir}/ (checksum ${brain.checksum()}, stored ${meta.checksum})`);
  if (meta.checksum && meta.checksum !== brain.checksum()) {
    log.warn('Checksum mismatch after restore!');
  }
  return brain;
}

module.exports = { save, restore, exists };
