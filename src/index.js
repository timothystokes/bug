'use strict';

const { buildConfig, estimateMemoryBytes } = require('./config');
const { Brain } = require('./brain');
const snapshot = require('./persist/snapshot');
const { Runner } = require('./core/runner');
const { startCLI } = require('./cli/cli');
const { parseArgs } = require('./util/args');
const logmod = require('./util/log');
const log = logmod.make('main');

function loadOrBirth(args) {
  const stateDir = args['state-dir'] || 'brain_state';
  let config;
  let brain;
  if (snapshot.exists(stateDir)) {
    // Restore: read the stored scale so geometry matches exactly.
    const meta = require('./persist/io').readJSON(require('path').join(stateDir, 'meta.json'));
    config = buildConfig({
      scale: meta.scale,
      nNeurons: meta.nNeurons,
      synapseDensity: meta.synapseDensity,
      stateDir,
    });
    brain = snapshot.restore(stateDir, config);
    // Boot: relax neuromodulators toward homeostatic baseline (mood carry-over).
    brain.neuromods.relax();
    log.info(`Resumed individual (genome seed ${brain.genome.seed}, age ${brain.epigenetic.simDays} days).`);
  } else {
    config = buildConfig({
      scale: args.scale,
      nNeurons: args.neurons,
      synapseDensity: args.density,
      stateDir,
    });
    const mb = (estimateMemoryBytes(config) / 1e9).toFixed(2);
    log.info(`No prior state. Estimated hot-state footprint: ${mb} GB for scale=${config.scale}.`);
    const seed = args.seed != null ? args.seed : (Date.now() & 0x7fffffff);
    brain = Brain.birth(config, seed);
    snapshot.save(brain, stateDir); // "birth" snapshot
  }
  return { brain, config, stateDir };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.log) logmod.setLevel(args.log);

  const { brain, stateDir } = loadOrBirth(args);
  const realtimeFactor = args.realtime != null ? Number(args.realtime) : 1.0;
  const runner = new Runner(brain, { stateDir, realtimeFactor });

  log.info(`Brain online — scale=${brain.config.scale}, neurons=${brain.populations.n}, synapses=${brain.synapses.m}.`);
  log.info(`Real-time pacing: ${isFinite(runner.targetTicksPerSec) ? runner.targetTicksPerSec.toFixed(2) + ' ticks/sec (factor ' + realtimeFactor + 'x)' : 'uncapped'}.`);
  console.log(JSON.stringify(brain.stats(), null, 2));

  runner.start();
  startCLI(brain, runner);
}

if (require.main === module) main();

module.exports = { loadOrBirth };
