'use strict';

// Region / population layout from the README "Initial Target & Implementation
// Plan" table. Fractions are derived from the honey-bee-tier allocation so that
// the same proportions hold at any scale.
//
//   Region            Neurons(full)   Role
//   V1                150K            visual cortex stub
//   A1                 80K            auditory cortex stub
//   Somatosensory      50K            stdin/stdout somatic signals
//   Thalamus           40K            two-system router
//   PFC               120K            rules / abstract categories
//   PPC                80K            sequence geometry (working memory)
//   Hippocampus        80K            DG/CA3/CA1 pattern sep+completion
//   Striatum           60K            action selection / RPE gating
//   Cerebellum        150K            timing / fine motor prediction
//   Motor              50K            speaker / stdout drive
//   IntrinsicNets      80K            DMN + salience + control
//   Brainstem          10K            DA/5-HT/NE/ACh/cortisol nuclei
//   LongRange          50K            Von Economo-like shortcut highways
//                   ------
//                    1000K
const REGION_TABLE = [
  { name: 'V1', frac: 150 / 1000, ei: 0.8, role: 'Camera input, Gabor-like predictive features' },
  { name: 'A1', frac: 80 / 1000, ei: 0.8, role: 'Microphone input, cochlea-filterbank features' },
  { name: 'Somatosensory', frac: 50 / 1000, ei: 0.8, role: 'Keyboard / log-line signals' },
  { name: 'Thalamus', frac: 40 / 1000, ei: 0.8, role: 'Lemniscal + extralemniscal split' },
  { name: 'PFC', frac: 120 / 1000, ei: 0.8, role: 'Mixed-selectivity abstract-rule encoding' },
  { name: 'PPC', frac: 80 / 1000, ei: 0.8, role: '2-D neural geometry working memory' },
  { name: 'Hippocampus', frac: 80 / 1000, ei: 0.85, role: 'Pattern separation + completion, episodic write' },
  { name: 'Striatum', frac: 60 / 1000, ei: 0.75, role: 'Action selection, RPE gating' },
  { name: 'Cerebellum', frac: 150 / 1000, ei: 0.8, role: 'Timing, fine motor prediction' },
  { name: 'Motor', frac: 50 / 1000, ei: 0.8, role: 'Speaker / stdout drive' },
  { name: 'IntrinsicNets', frac: 80 / 1000, ei: 0.8, role: 'DMN + salience + control networks' },
  { name: 'Brainstem', frac: 10 / 1000, ei: 0.7, role: 'DA/5-HT/NE/ACh/cortisol broadcast' },
  { name: 'LongRange', frac: 50 / 1000, ei: 0.95, role: 'Von Economo-like shortcut highways' },
];

// Scale presets. synapseDensity = average synapses (out-degree) per neuron.
const SCALES = {
  // Boots in <1s. For tests and quick smoke checks.
  tiny: {
    nNeurons: 2000,
    synapseDensity: 50,
    label: 'tiny',
  },
  // Default dev scale. Boots in <10s, <1GB RAM. ~10K neurons / ~1M synapses.
  dev: {
    nNeurons: 10000,
    synapseDensity: 100,
    label: 'dev',
  },
  // Honey-bee tier from the README. ~1M neurons / ~700M-1B synapses, ~22GB.
  // Math/code path supported; not run by default (see IMPLEMENTATION.md).
  full: {
    nNeurons: 1000000,
    synapseDensity: 750,
    label: 'full',
  },
};

// Connectome prior: within-region connection probability is high; between-region
// is shaped by this coarse adjacency. Values are relative weights, normalised by
// the connection builder. Missing pairs default to a small baseline.
const CONNECTOME_PRIOR = {
  // sensory -> thalamus -> cortex
  V1: { Thalamus: 0.8, PFC: 0.3, PPC: 0.2, Hippocampus: 0.2, LongRange: 0.4 },
  A1: { Thalamus: 0.8, PFC: 0.3, PPC: 0.2, Hippocampus: 0.2, LongRange: 0.4 },
  Somatosensory: { Thalamus: 0.8, PFC: 0.3, Motor: 0.3, Hippocampus: 0.2, LongRange: 0.3 },
  Thalamus: { V1: 0.6, A1: 0.6, Somatosensory: 0.6, PFC: 0.5, IntrinsicNets: 0.3 },
  PFC: { PPC: 0.5, Striatum: 0.5, Hippocampus: 0.4, Motor: 0.4, IntrinsicNets: 0.5, LongRange: 0.6 },
  PPC: { PFC: 0.5, Motor: 0.3, Hippocampus: 0.3, LongRange: 0.4 },
  Hippocampus: { PFC: 0.4, PPC: 0.3, IntrinsicNets: 0.3, LongRange: 0.3 },
  Striatum: { Motor: 0.5, PFC: 0.3, Brainstem: 0.4 },
  Cerebellum: { Motor: 0.5, Thalamus: 0.3, PFC: 0.2 },
  Motor: { Cerebellum: 0.3, Striatum: 0.3, Somatosensory: 0.2 },
  IntrinsicNets: { PFC: 0.5, Hippocampus: 0.3, Brainstem: 0.3, LongRange: 0.4 },
  Brainstem: { PFC: 0.3, Striatum: 0.3, IntrinsicNets: 0.3, Hippocampus: 0.2 },
  LongRange: { PFC: 0.6, Hippocampus: 0.5, V1: 0.4, A1: 0.4, IntrinsicNets: 0.4 },
};

const DEFAULT_TUNABLES = {
  // Synapse weights ~N(0, weightInitStd), clipped to [wMin, wMax].
  weightInitStd: 0.1,
  wMin: -1.0,
  wMax: 1.0,
  // Probability that an intra-region candidate synapse is realised.
  withinRegionProb: 0.15,
  baselineBetweenProb: 0.01,
  // STDP window (ms-analogue) and learning rates.
  stdpTauPlus: 20,
  stdpTauMinus: 20,
  stdpAplus: 0.01,
  stdpAminus: 0.012,
  // Predictive-coding local Hebbian rate.
  pcLearnRate: 0.02,
  // Neuromodulator update cadence (ticks) and epigenetic cadence (ticks).
  neuromodEveryTicks: 200,
  epigeneticEveryTicks: 20000,
  // Biological time mapping: 1 tick = 1 ms (standard computational-neuro dt),
  // so a simulated day is 86_400_000 ticks. The simulator runs as fast as the
  // hardware allows; sim-time accumulates at whatever rate the CPU can sustain
  // (typically much slower than wall time for an honest biological model).
  msPerTick: 1,
  ticksPerSimDay: 86400000,
  // Hippocampal write threshold on salience/surprise.
  hippoWriteThreshold: 0.6,
  episodicCap: 5000,
  // Working-memory buffer length.
  wmCapacity: 7,
  // Sparsity target (fraction of neurons allowed active) for sparse coding.
  sparsityTarget: 0.05,
  // Synaptic transmission gain applied at delivery (scales EPSP/IPSP).
  synapticGain: 9.0,
  // Spontaneous background drive (Poisson kicks) keeps the network near
  // criticality even with no sensory input (biological baseline activity).
  backgroundRate: 0.02, // fraction of neurons kicked per tick
  backgroundAmp: 11.0,
  // Bounded compute budget per thought: breadth x depth x recurrent steps.
  computeBudget: { breadth: 256, depth: 4, recurrentSteps: 3 },
  // Replay speed multiplier during sleep.
  replaySpeed: 20,
  // Oscillatory bands (Hz-analogue) for binding.
  oscillatoryBands: { theta: 6, alpha: 10, beta: 20, gamma: 40 },
};

function buildConfig(opts = {}) {
  const scaleName = opts.scale && SCALES[opts.scale] ? opts.scale : 'dev';
  const scale = SCALES[scaleName];
  const nNeurons = opts.nNeurons || scale.nNeurons;
  const synapseDensity = opts.synapseDensity || scale.synapseDensity;

  // Allocate neurons across regions by fraction, ensuring the total matches.
  const regions = [];
  let assigned = 0;
  for (let i = 0; i < REGION_TABLE.length; i++) {
    const r = REGION_TABLE[i];
    let count = Math.max(1, Math.round(r.frac * nNeurons));
    if (i === REGION_TABLE.length - 1) count = nNeurons - assigned; // absorb rounding
    regions.push({
      index: i,
      name: r.name,
      role: r.role,
      eiRatio: r.ei,
      count,
      start: assigned,
      end: assigned + count,
    });
    assigned += count;
  }

  return {
    scale: scaleName,
    nNeurons: assigned,
    synapseDensity,
    estSynapses: assigned * synapseDensity,
    regions,
    connectomePrior: CONNECTOME_PRIOR,
    tunables: Object.assign({}, DEFAULT_TUNABLES, opts.tunables || {}),
    stateDir: opts.stateDir || 'brain_state',
  };
}

function regionByName(config, name) {
  return config.regions.find((r) => r.name === name);
}

// Approximate memory footprint of the hot numeric state for a given config.
function estimateMemoryBytes(config) {
  const n = config.nNeurons;
  const s = config.estSynapses;
  // Per-neuron: v,u(Float32=8) + a,b,c,d(Float32=16) + type,class(Uint8=2)
  //   + region(Uint16=2) + current,trace(Float32=8) + spike,lastSpike(9) + glia(4)
  const perNeuron = 8 + 16 + 2 + 2 + 8 + 1 + 4 + 4;
  // Per-synapse: post(Uint32=4) + weight(Float32=4) + delay(Uint8=1)
  //   + stdp/eligibility(Float32=4) = 13B, plus CSR offsets amortised.
  const perSynapse = 13;
  return n * perNeuron + s * perSynapse + (n + 1) * 4;
}

module.exports = {
  buildConfig,
  regionByName,
  estimateMemoryBytes,
  SCALES,
  REGION_TABLE,
  CONNECTOME_PRIOR,
  DEFAULT_TUNABLES,
};
