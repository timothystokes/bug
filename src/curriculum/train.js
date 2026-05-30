'use strict';

const { buildConfig } = require('../config');
const { Brain } = require('../brain');
const snapshot = require('../persist/snapshot');
const { Curriculum } = require('./curriculum');
const { parseArgs } = require('../util/args');
const logmod = require('../util/log');
const log = logmod.make('train');

// Automation harness entry point (npm run train). Runs the brain faster than
// real time on a synthetic curriculum, with no human in the loop. Target:
// ~24x real-time (1 simulated day / wall-clock hour) at honey-bee scale; at dev
// scale it runs far faster. Learning is logged so progress is observable.
async function train(argv) {
  const args = parseArgs(argv);
  if (args.log) logmod.setLevel(args.log);
  const stateDir = args['state-dir'] || 'brain_state';

  // Duration: --minutes or --hours (wall clock), or --ticks (hard tick budget).
  const minutes = args.minutes != null ? args.minutes : (args.hours != null ? args.hours * 60 : null);
  const tickBudget = args.ticks != null ? args.ticks : null;
  const wallMs = minutes != null ? minutes * 60 * 1000 : (tickBudget != null ? Infinity : 60 * 1000);

  // Load or birth.
  let brain;
  let config;
  if (snapshot.exists(stateDir)) {
    const meta = require('../persist/io').readJSON(require('path').join(stateDir, 'meta.json'));
    config = buildConfig({ scale: meta.scale, nNeurons: meta.nNeurons, synapseDensity: meta.synapseDensity, stateDir });
    brain = snapshot.restore(stateDir, config);
  } else {
    config = buildConfig({ scale: args.scale, nNeurons: args.neurons, synapseDensity: args.density, stateDir });
    brain = Brain.birth(config, args.seed != null ? args.seed : 4242);
    snapshot.save(brain, stateDir);
  }
  brain.stdoutMotor.silent = true; // don't spam stdout during fast training

  const curriculum = new Curriculum({ seed: args.seed != null ? args.seed : 4242 });
  const ticksPerDay = config.tunables.ticksPerSimDay;

  const startTick = brain.tickCount;
  const startError = brain.predictive.totalError;
  const startEpisodes = brain.hippocampus.episodes.length;
  const startDA = brain.neuromods.level.da;
  const start = Date.now();
  let lastLog = start;

  log.info(`Training scale=${config.scale} for ${minutes != null ? minutes + ' min' : (tickBudget || '∞') + ' ticks'} ...`);
  log.info('Press Ctrl-C once for graceful stop (runs sleep+save before exiting).');

  // Graceful shutdown: SIGINT/SIGTERM flips a flag; loop notices and breaks out
  // into the normal end-of-session sleep+snapshot path. Second signal hard-exits.
  let stopRequested = false;
  const onSig = (sig) => {
    if (stopRequested) {
      log.warn(`Second ${sig} — hard exit, state since last autosave is lost.`);
      process.exit(130);
    }
    stopRequested = true;
    log.info(`Received ${sig}: finishing current batch, then sleep+save...`);
  };
  process.on('SIGINT', onSig);
  process.on('SIGTERM', onSig);

  // Periodic autosave so a hard kill doesn't lose everything.
  const autosaveEveryMs = 30000;
  let lastSave = Date.now();

  function feedSome() {
    // Keep the somatic channel supplied with curriculum tokens.
    while (brain.textSensor.queue.length < 8) {
      const item = curriculum.next();
      brain.textSensor.feed(item.token, item.reward);
    }
  }

  let elapsed = 0;
  while (true) {
    const now = Date.now();
    elapsed = now - start;
    if (wallMs !== Infinity && elapsed >= wallMs) break;
    if (tickBudget != null && (brain.tickCount - startTick) >= tickBudget) break;
    if (stopRequested) break;

    // Run a time-bounded batch, refilling curriculum as we go.
    const batchStart = Date.now();
    while ((Date.now() - batchStart) < 50) {
      if (brain.textSensor.queue.length < 4) feedSome();
      brain.tick();
    }

    if (now - lastLog >= 2000) {
      lastLog = now;
      const simDays = ((brain.tickCount - startTick) / ticksPerDay);
      const tps = (brain.tickCount - startTick) / (elapsed / 1000);
      log.info(
        `t=${brain.tickCount} simDays=${simDays.toFixed(3)} `
        + `lesson=${curriculum.currentLesson()} `
        + `predErr=${brain.predictive.totalError.toFixed(4)} `
        + `selfErr=${brain.selfModel.selfPredictionError.toFixed(4)} `
        + `eps=${brain.hippocampus.episodes.length} `
        + `concepts=${brain.cognitiveMap.size()} `
        + `DA=${brain.neuromods.level.da.toFixed(3)} `
        + `EIact=${brain.monitor.eiRatio.toFixed(2)} `
        + `cmplx=${brain.monitor.complexity.toFixed(3)} `
        + `tps=${Math.round(tps)}`
      );
    }
    if (now - lastSave >= autosaveEveryMs) {
      lastSave = now;
      snapshot.save(brain, stateDir);
      log.debug(`autosave at t=${brain.tickCount}`);
    }
    await new Promise((r) => setImmediate(r));
  }

  // End-of-session sleep consolidation + snapshot (README per-session lifecycle).
  log.info('Session end: entering sleep/replay consolidation...');
  brain.sleep(500);
  brain.stdoutMotor.silent = false;
  snapshot.save(brain, stateDir);

  const tps = (brain.tickCount - startTick) / (Math.max(1, elapsed) / 1000);
  const realTimeFactor = (tps / (ticksPerDay / 86400)); // ticks/s vs day/s
  log.info('==== Training summary ====');
  log.info(`ticks run:        ${brain.tickCount - startTick}`);
  log.info(`sim days:         ${((brain.tickCount - startTick) / ticksPerDay).toFixed(3)}`);
  log.info(`ticks/sec:        ${Math.round(tps)}`);
  log.info(`real-time factor: ${realTimeFactor.toFixed(1)}x  (target ~24x)`);
  log.info(`predErr:          ${startError.toFixed(4)} -> ${brain.predictive.totalError.toFixed(4)}`);
  log.info(`episodes:         ${startEpisodes} -> ${brain.hippocampus.episodes.length}`);
  log.info(`dopamine:         ${startDA.toFixed(3)} -> ${brain.neuromods.level.da.toFixed(3)}`);
  log.info(`concepts learned: ${brain.cognitiveMap.size()}`);
  log.info(`checksum:         ${brain.checksum()}`);
  return brain;
}

if (require.main === module) {
  train(process.argv.slice(2)).then(() => process.exit(0)).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { train };
