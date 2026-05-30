'use strict';

const { Genome } = require('./genome/genome');
const { Populations, TYPE_E } = require('./populations/populations');
const { Synapses } = require('./synapses/synapses');
const { Glia } = require('./glia/glia');
const { Neuromodulators } = require('./modulators/neuromodulators');
const { Oscillators } = require('./oscillators/oscillators');
const { Thalamus } = require('./thalamus/thalamus');
const { Monitor } = require('./monitor/monitor');
const { HigherOrder } = require('./monitor/higher_order');
const { PredictiveCoding } = require('./core/predictive_coding');
const { Hippocampus } = require('./hippocampus/hippocampus');
const { IntrinsicNetworks } = require('./intrinsic_nets/intrinsic_nets');
const { WorkingMemory } = require('./core/working_memory');
const { CognitiveMap } = require('./cognitive_map/cognitive_map');
const { Epigenetic } = require('./core/epigenetic');
const { ComputeBudget } = require('./core/compute_budget');
const { SelfModel } = require('./core/self_model');
const { Drives } = require('./core/drives');
const { TextSensor } = require('./sensors/text_sensor');
const { MicrophoneSensor, CameraSensor } = require('./sensors/scaffold_sensors');
const { StdoutMotor, SpeakerMotor } = require('./motors/motors');
const { RNG } = require('./util/rng');
const log = require('./util/log').make('brain');

// Top-level Brain. Wires every subsystem and runs the Detect -> Integrate ->
// Mark -> Execute (DIME) control loop (Principle 21).
class Brain {
  constructor(config) {
    this.config = config;
    this.tickCount = 0;
    this.lifetimeSpikes = 0;
    this.lastSalience = 0;
    this.lastInputDrive = 0;
    this.lastToken = null;
    this.phase = 'wake'; // wake | sleep
  }

  // ---- Birth: first-ever boot (README "Baseline state"). ----
  static birth(config, seed) {
    const brain = new Brain(config);
    brain.genome = Genome.conceive(seed >>> 0);
    const rng = new RNG(brain.genome.seed);
    brain.rng = new RNG(brain.genome.seed ^ 0xa5a5a5a5);

    brain.populations = new Populations(config.nNeurons);
    brain.populations.init(config, rng.fork(1));
    brain.synapses = Synapses.build(config, brain.populations, rng.fork(2));
    brain.glia = new Glia(config.nNeurons);
    brain._initSubsystems();
    log.info(`Birth: ${config.nNeurons} neurons, ${brain.synapses.m} synapses, scale=${config.scale}`);
    return brain;
  }

  _initSubsystems() {
    const config = this.config;
    const T = config.tunables;
    this.neuromods = new Neuromodulators(this.genome);
    this.oscillators = new Oscillators(T.oscillatoryBands);
    this.thalamus = new Thalamus(config);
    this.monitor = new Monitor();
    this.higherOrder = new HigherOrder(config);
    this.predictive = new PredictiveCoding(config);
    this.hippocampus = new Hippocampus(config, this.genome);
    this.intrinsic = new IntrinsicNetworks(config);
    this.workingMemory = new WorkingMemory(T.wmCapacity);
    this.cognitiveMap = new CognitiveMap();
    this.epigenetic = new Epigenetic(this.genome);
    this.budget = new ComputeBudget(T.computeBudget);
    this.selfModel = new SelfModel();
    this.drives = new Drives();
    // Sensors / motors.
    this.textSensor = new TextSensor();
    this.microphone = new MicrophoneSensor();
    this.camera = new CameraSensor();
    this.stdoutMotor = new StdoutMotor(config);
    this.speaker = new SpeakerMotor();
    this.sensors = [this.textSensor, this.microphone, this.camera];
  }

  // ---- One DIME cycle. ----
  tick() {
    const pops = this.populations;
    const T = this.config.tunables;
    const t = this.tickCount;

    // ===== DETECT =====
    pops.clearCurrent();
    this.synapses.deliver(pops, t, T.synapticGain); // spikes in flight arrive now
    this.oscillators.step();
    this._backgroundDrive();

    let salience = 0;
    let inputDrive = 0;
    let token = null;
    let extrinsicReward = 0;
    let interacted = false;
    let lastVector = null;
    for (const sensor of this.sensors) {
      if (!sensor.hasInput || !sensor.hasInput()) continue;
      const packet = sensor.pull();
      if (!packet) continue;
      interacted = true;
      const routed = this.thalamus.route(packet, pops, this.neuromods);
      salience = Math.max(salience, routed.salience);
      inputDrive += routed.content;
      if (packet.token != null) token = packet.token;
      if (packet.reward != null) extrinsicReward = packet.reward;
      lastVector = packet.vector;
    }
    // Intrinsic networks: DMN spontaneous activity when idle, action-mode on input.
    this.intrinsic.update(pops, inputDrive, salience, this.neuromods);
    // Oscillatory theta gain (Principle 14) scales drive (encoding window).
    const thetaGain = this.oscillators.thetaGain();

    // ===== INTEGRATE =====
    // Predictive coding injects only residuals upward (Principle 16).
    const plasticityMult = this.epigenetic.plasticityMultiplier();
    const plasticityGain = this.neuromods.plasticityGain() * plasticityMult;
    const pcError = this.predictive.tick(pops, plasticityGain);
    // Bounded compute budget: how many recurrent integrate sub-steps (Principle 19).
    const steps = this.budget.recurrentSteps(pcError);
    let totalSpikes = 0;
    for (let s = 0; s < steps; s++) {
      if (s > 0) { this.synapses.deliver(pops, t, T.synapticGain); }
      // Scale by theta gain on the first sub-step only.
      if (s === 0) for (let i = 0; i < pops.n; i++) pops.current[i] *= thetaGain;
      this.glia.modulate(pops);                 // glial fuel gating (Principle 13)
      const spk = pops.step(t, T.stdpTauPlus > 0 ? Math.exp(-1 / T.stdpTauPlus) : 0.95);
      totalSpikes += spk;
      this.synapses.propagate(pops, t);         // schedule spikes into delay ring
      this.synapses.stdp(pops, plasticityGain, T); // STDP (Principle 1)
    }
    this.lifetimeSpikes += totalSpikes;
    // Sparse coding regulariser (Principle 18): if too many active, raise global
    // inhibition next tick by depressing rates (k-WTA-like homeostasis).
    this._enforceSparsity(totalSpikes);

    // ===== MARK =====
    this.monitor.observe(pops, totalSpikes);
    const spikeFraction = totalSpikes / pops.n;
    // Intrinsic reward: prediction-error reduction + novelty (Principle 5/16).
    const intrinsicReward = clamp01(0.5 + (this.predictive.totalError - pcError) * 5
      + salience * 0.3) * this.genome.curiosityGain * 0.5;
    const reward = clamp01(0.6 * intrinsicReward + 0.4 * extrinsicReward);
    const rpe = this.neuromods.rewardPredictionError(reward);
    if (salience > 0.05) this.neuromods.surprise(salience);
    this.drives.update(spikeFraction, salience, interacted);
    if (this.drives.energy < 0.2) this.neuromods.stress(0.3); // fatigue -> cortisol
    // Apply RPE-gated consolidation of eligibility traces (Principle 5).
    if (Math.abs(rpe) > 0.05) this.synapses.applyReward(rpe, T);
    // Working memory + cognitive map track the perceived concept (Principles 6,17).
    if (token != null && token !== ' ') {
      this.workingMemory.push(token);
      this.cognitiveMap.observe(token);
      this.lastToken = token;
    }
    // Hippocampal write decision (Principle 15).
    const modalities = interacted ? this.sensors.filter((s) => s.hasInput && s.hasInput()).map((s) => s.modality) : [];
    const writeSalience = Math.max(salience, reward, this.monitor.criticality > 1.2 ? 0.7 : 0);
    this.hippocampus.maybeWrite(pops, writeSalience, modalities.length ? modalities : ['text'], t, this.neuromods);

    // ===== EXECUTE =====
    const exploration = this.neuromods.explorationDrive(this.genome) + this.drives.curiosity() * 0.2;
    const action = this.stdoutMotor.act(pops, exploration, this.rng);
    if (action) {
      this.speaker.emit(action.symbolIndex);
      this.selfModel.predictConsequence(action);
    }
    // Closed loop: the previous action's consequence is this tick's input.
    if (lastVector) {
      const selfErr = this.selfModel.observeConsequence(lastVector);
      if (selfErr > 0.5) this.neuromods.surprise(0.1);
    }

    this.lastSalience = salience;
    this.lastInputDrive = inputDrive;
    this.tickCount++;
    this._slowClocks();
    return { totalSpikes, pcError, reward, rpe };
  }

  // Spontaneous background activity: sparse Poisson kicks keep the network near
  // criticality (biological baseline) and let spikes propagate. Principle 18:
  // the kicks are sparse by construction.
  _backgroundDrive() {
    const T = this.config.tunables;
    const n = this.populations.n;
    const k = Math.max(1, Math.floor(T.backgroundRate * n));
    const amp = T.backgroundAmp;
    const cur = this.populations.current;
    for (let j = 0; j < k; j++) {
      cur[this.rng.int(n)] += amp * (0.5 + this.rng.random());
    }
  }

  _enforceSparsity(totalSpikes) {
    const target = this.config.tunables.sparsityTarget * this.populations.n;
    if (totalSpikes > target * 2) {
      // Too active: nudge membranes down (global inhibitory homeostasis).
      const v = this.populations.v;
      for (let i = 0; i < this.populations.n; i++) v[i] -= 1.0;
    }
  }

  _slowClocks() {
    const T = this.config.tunables;
    const t = this.tickCount;
    // Neuromodulator homeostatic relaxation (slow clock).
    if (t % T.neuromodEveryTicks === 0) this.neuromods.relax();
    // Monitor heavy analysis + higher-order flow decomposition (medium clock).
    if (t % 256 === 0) {
      this.monitor.analyse();
      this.higherOrder.analyse(this.populations);
    }
    // Epigenetic / developmental clock: advanced continuously every tick.
    const dayDelta = 1 / T.ticksPerSimDay;
    const crossed = this.epigenetic.advance(dayDelta, this.synapses);
    if (crossed) {
      log.info(`Simulated day ${Math.floor(this.epigenetic.simDays)} (${this.epigenetic.phase()})`);
    }
  }

  // ---- Sleep / offline replay (Principle: sleep consolidation). ----
  sleep(cycles) {
    const prevPhase = this.phase;
    this.phase = 'sleep';
    const replaySpeed = this.config.tunables.replaySpeed;
    let totalReplayed = 0;
    this.stdoutMotor.silent = true;
    for (let c = 0; c < cycles; c++) {
      this.populations.clearCurrent();
      // DMN forks imagined replays (Principle: dreaming/parallel branches).
      const replayed = this.hippocampus.replayInto(this.populations, replaySpeed);
      totalReplayed += replayed;
      this.glia.modulate(this.populations);
      this.populations.step(this.tickCount + c, 0.95);
      this.synapses.stdp(this.populations, this.neuromods.plasticityGain() * 0.5, this.config.tunables);
      this.predictive.tick(this.populations, this.neuromods.plasticityGain());
    }
    this.drives.rest();
    this.epigenetic.tickDay(this.synapses); // a sleep advances development one step
    this.stdoutMotor.silent = false;
    this.phase = prevPhase;
    log.info(`Slept ${cycles} cycles, replayed ${totalReplayed} engram-activations, day=${this.epigenetic.simDays}`);
    return { cycles, totalReplayed };
  }

  // ---- Sim-time helpers (biological clock; dt = msPerTick) ----
  simMs() {
    return this.tickCount * (this.config.tunables.msPerTick || 1);
  }
  simTimeString() {
    return formatSimTime(this.simMs());
  }

  // ---- Introspection ----
  stats() {
    const ws = this.synapses.weightStats(this.populations);
    const m = this.monitor.snapshot();
    return {
      scale: this.config.scale,
      neurons: this.populations.n,
      synapses: this.synapses.m,
      tick: this.tickCount,
      simTime: this.simTimeString(),
      lifetimeSpikes: this.lifetimeSpikes,
      age_simDays: round(this.epigenetic.simDays, 4),
      developmentalPhase: this.epigenetic.phase(),
      plasticityMult: round(this.epigenetic.plasticityMultiplier()),
      eiActivityRatio: round(m.eiRatio),
      meanWeightE: round(ws.meanE, 4),
      meanWeightI: round(ws.meanI, 4),
      aperiodicSlope: round(m.aperiodicSlope, 4),
      complexity: round(m.complexity, 4),
      synergy: round(m.synergy, 4),
      criticality: round(m.criticality, 4),
      predictionError: round(this.predictive.totalError, 4),
      selfPredictionError: round(this.selfModel.selfPredictionError, 4),
      episodes: this.hippocampus.episodes.length,
      concepts: this.cognitiveMap.size(),
      workingMemory: this.workingMemory.sequence().join(''),
      mode: {
        dmn: round(this.intrinsic.mode.dmn),
        action: round(this.intrinsic.mode.action),
        salience: round(this.intrinsic.mode.salience),
        control: round(this.intrinsic.mode.control),
      },
      neuromods: Object.fromEntries(Object.entries(this.neuromods.level).map(([k, v]) => [k, round(v)])),
      drives: { energy: round(this.drives.energy), novelty: round(this.drives.novelty), social: round(this.drives.social) },
      glia: round(this.glia.mean()),
      higherOrder: {
        divergence: round(this.higherOrder.divergence, 3),
        gradient: round(this.higherOrder.gradientEnergy, 3),
        curl: round(this.higherOrder.curlEnergy, 3),
      },
      computeSpent: this.budget.spent,
      genomeSeed: this.genome.seed,
    };
  }

  examine(index) {
    const i = index >>> 0;
    if (i >= this.populations.n) return { error: 'index out of range' };
    const p = this.populations;
    const region = this.config.regions[p.region[i]];
    // Engram participation: which episodes' codes index near this neuron's slab.
    const engrams = [];
    for (const ep of this.hippocampus.episodes) {
      if (ep.active.some((c) => (c % p.n) === i || region.start + (c % region.count) === i)) {
        engrams.push(ep.id);
      }
    }
    return {
      index: i,
      region: region.name,
      population: p.type[i] === TYPE_E ? 'excitatory' : 'inhibitory',
      cellClass: ['RS', 'IB', 'FS', 'LTS'][p.cellClass[i]],
      v: round(p.v[i], 3),
      u: round(p.u[i], 3),
      rate: round(p.rate[i], 4),
      lastSpike: p.lastSpike[i],
      outDegree: this.synapses.offsets[i + 1] - this.synapses.offsets[i],
      glia: round(this.glia.resource[i], 3),
      engrams: engrams.slice(0, 8),
    };
  }

  // Deterministic checksum over learned + developmental state (for resume proof).
  checksum() {
    let h = 2166136261 >>> 0;
    const mix = (x) => { h ^= x >>> 0; h = Math.imul(h, 16777619) >>> 0; };
    const w = this.synapses.weight;
    const step = Math.max(1, Math.floor(w.length / 100000));
    for (let k = 0; k < w.length; k += step) mix(Math.round(w[k] * 1e6));
    mix(this.tickCount);
    mix(this.epigenetic.simDays);
    mix(this.populations.n);
    mix(this.synapses.m);
    mix(Math.round(this.predictive.totalError * 1e6));
    return ('00000000' + h.toString(16)).slice(-8);
  }

  // Feed external (human) text into the somatic channel.
  feedText(text) {
    for (const ch of text) this.textSensor.feed(ch);
  }
}

function round(x, d = 3) {
  if (x == null || Number.isNaN(x)) return 0;
  const f = Math.pow(10, d);
  return Math.round(x * f) / f;
}

function formatSimTime(ms) {
  if (!ms || ms < 0) return '0ms';
  let s = Math.floor(ms / 1000);
  const millis = Math.floor(ms % 1000);
  const days = Math.floor(s / 86400); s -= days * 86400;
  const hours = Math.floor(s / 3600); s -= hours * 3600;
  const mins = Math.floor(s / 60); s -= mins * 60;
  const parts = [];
  if (days) parts.push(days + 'd');
  if (hours || days) parts.push(hours + 'h');
  if (mins || hours || days) parts.push(mins + 'm');
  parts.push(s + (millis && !days && !hours && !mins ? '.' + String(millis).padStart(3, '0') : '') + 's');
  return parts.join(' ');
}

module.exports.formatSimTime = formatSimTime;

function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

module.exports = { Brain };
