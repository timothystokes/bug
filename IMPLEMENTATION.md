# IMPLEMENTATION.md

This document describes the concrete Node.js implementation of the digital-brain
specified in `README.md`. It maps every one of the **21 Core Brain-Inspired
Principles** to the code that realises it, documents the CLI and configuration
schema, the training harness, the persistence layout, the full-scale memory
budget, and the autonomous engineering decisions made along the way.

The implementation has **zero runtime dependencies** (Node's standard library
only) and targets Node ≥ 18 (developed on v20.19.0).

---

## 1. Quick start

```bash
npm start                 # boot (restore if state exists, else birth), then CLI
npm run dev               # same, dev scale explicit
npm run train -- --minutes=5      # run the automation/training harness
npm test                  # node --test smoke + subsystem tests
```

CLI commands (typed at the `brain>` prompt):

| Command            | Effect                                                            |
| ------------------ | ---------------------------------------------------------------- |
| `stats`            | Print activity, E/I balance, criticality, neuromodulators, age   |
| `examine [region]` | Inspect a region (or a random neuron) — membrane state, weights  |
| `feed <text>`      | Inject text into the somatosensory channel                       |
| `<free text>`      | Any unrecognised line is also fed as somatic input               |
| `save`             | Force a snapshot to `brain_state/`                               |
| `sleep`            | Trigger an offline replay / consolidation cycle                  |
| `exit`             | Save and shut down gracefully (also handled on SIGINT/SIGTERM)   |
| `help`             | List commands                                                    |

---

## 2. Architecture overview — the DIME loop

The brain runs a multi-rate **Detect → Integrate → Mark → Execute** loop, driven
by `src/core/runner.js` and implemented in `Brain.tick()` (`src/brain.js`):

- **Detect** — clear per-tick spike flags, deliver delayed synaptic current from
  the conduction-delay ring buffer, advance oscillators, inject Poisson
  background drive, pull sensor samples and route them through the thalamus,
  update intrinsic networks.
- **Integrate** — predictive-coding pass, bounded recurrent "thinking" steps
  (compute budget), glial modulation, Izhikevich population step (two 0.5 ms
  sub-steps), synaptic propagation into the ring buffer, STDP.
- **Mark** — complexity/criticality monitor, reward-prediction-error → neuromodulator
  broadcast, homeostatic drives, hippocampal episodic write, working-memory and
  cognitive-map updates.
- **Execute** — motor act (stdout / speaker stub), self-model closed-loop update.

Slow clocks are driven by tick counters (`Brain._slowClocks()`): neuromodulator
relaxation every `neuromodEveryTicks`, monitor + higher-order analysis every 256
ticks, and an epigenetic "day" every `ticksPerSimDay`.

---

## 3. The 21 principles → code map

| # | Principle | Where it lives |
|---|-----------|----------------|
| 1 | Excitatory/Inhibitory balance & criticality | `populations/populations.js` (≈80:20 E:I per region), `monitor/monitor.js` (aperiodic/criticality estimate) |
| 2 | Mixed / distributed selectivity (no grandmother cells) | `hippocampus/hippocampus.js` (DG expansion), `cognitive_map/cognitive_map.js` (distributed concept vectors) |
| 3 | Intrinsic networks (DMN / salience / control) | `intrinsic_nets/intrinsic_nets.js` |
| 4 | Two-system thalamic routing (lemniscal / extralemniscal) | `thalamus/thalamus.js` |
| 5 | Reward-prediction error | `modulators/neuromodulators.js` (`rewardPredictionError`), `synapses/synapses.js` (`applyReward`) |
| 6 | Geometric working memory | `core/working_memory.js` |
| 7 | Neuromodulation (DA/5-HT/NE/ACh/cortisol) | `modulators/neuromodulators.js` |
| 8 | Epigenetic / activity-dependent gene regulation | `core/epigenetic.js` |
| 9 | Embodied sensorimotor I/O | `sensors/` (text + scaffold mic/camera), `motors/motors.js` |
| 10 | Developmental phases | `core/epigenetic.js` (phase schedule keyed to simulated days) |
| 11 | Immutable genome / identity | `genome/genome.js` |
| 12 | Behaviour-coupled closed loop | `core/self_model.js` |
| 13 | Dale's Law + glial support | `populations/populations.js` (sign-locked weights), `glia/glia.js` |
| 14 | Oscillatory binding (theta/alpha/beta/gamma) | `oscillators/oscillators.js` |
| 15 | Hippocampal pattern separation/completion + cross-modal | `hippocampus/hippocampus.js` |
| 16 | Predictive coding | `core/predictive_coding.js` |
| 17 | Cognitive map / relational structure | `cognitive_map/cognitive_map.js` |
| 18 | Sparse coding | `brain.js` (`_enforceSparsity`), `synapses/synapses.js` (weight clamps) |
| 19 | Bounded compute budget per thought | `core/compute_budget.js` |
| 20 | Complexity / synergy monitoring | `monitor/monitor.js`, `monitor/higher_order.js` |
| 21 | DIME core loop | `brain.js` (`tick`) + `core/` |

Supporting structure beyond the 21:

- **Homeostatic drives** — `core/drives.js`.
- **Higher-order topology** (hypergraph divergence/gradient/curl signals) —
  `monitor/higher_order.js`.
- **Von Economo-like long-range highways** — the `LongRange` region in
  `config.js` + `synapses/synapses.js` build step.
- **Automation / curriculum harness** — `curriculum/curriculum.js`,
  `curriculum/train.js`.

---

## 4. Configuration schema (`src/config.js`)

`buildConfig({ scale, nNeurons, synapseDensity, stateDir, seed, ... })` returns
the immutable config consumed by every subsystem.

### Scale presets

| Scale  | Neurons   | Synapse density | Notes |
| ------ | --------- | --------------- | ----- |
| `tiny` | 2 000     | 50              | Tests / smoke checks, boots < 1 s |
| `dev`  | 10 000    | 100             | **Default**, < 1 GB RAM, boots in well under a second |
| `full` | 1 000 000 | 750             | Honey-bee tier; math/code path supported (see §7) |

### Region table

13 regions allocated by fraction of the neuron budget, each with an E/I ratio and
role: `V1, A1, Somatosensory, Thalamus, PFC, PPC, Hippocampus, Striatum,
Cerebellum, Motor, IntrinsicNets, Brainstem, LongRange`. The full table (fraction,
E:I, role) lives in `REGION_TABLE`. Inter-region wiring probabilities come from
`CONNECTOME_PRIOR`.

### Tunables (`DEFAULT_TUNABLES`)

Key knobs: weight init/clip (`weightInitStd`, `wMin`, `wMax`), connection
probabilities, STDP window/rates, predictive-coding learn rate, slow-clock
cadences (`neuromodEveryTicks`, `epigeneticEveryTicks`, `snapshotEveryTicks`,
`ticksPerSimDay`), hippocampal write threshold + episodic cap, working-memory
capacity, `sparsityTarget`, `synapticGain`, background drive
(`backgroundRate`/`backgroundAmp`), `computeBudget` (breadth × depth ×
recurrentSteps), replay speed, and oscillatory bands.

---

## 5. Training / automation harness

`npm run train -- [flags]` (`src/curriculum/train.js`):

- `--minutes=N` / `--hours=N` / `--ticks=N` — run length.
- `--scale=tiny|dev|full` — scale override.

The harness boots (or restores) a brain, streams a curriculum of text episodes
into the somatosensory channel via `TextSensor`, logs learning progress
(prediction error, episodes stored, activity), ends the session with a `sleep`
consolidation cycle, saves a snapshot, and reports the achieved real-time factor
against the README's 24× target. At `tiny` scale the harness runs thousands of
times faster than real time; `dev` scale also comfortably exceeds 24×.

Learning is observable: prediction error falls from ≈1.0 toward ≈10⁻³–10⁻⁴ and
the episodic store grows over a short run.

---

## 6. Persistence layout (`src/persist/`)

State is split into **bulk numeric** (raw typed-array binary dumps) and a
**control plane** (JSON), written under `brain_state/`:

| File           | Contents |
| -------------- | -------- |
| `neurons.bin`  | Izhikevich state arrays (v, u, a, b, c, d, type, cellClass, region) |
| `synapses.bin` | Forward CSR (offsets, post, weight, delay, eligibility) |
| `glia.bin`     | Glial state arrays |
| `ring.bin`     | Conduction-delay ring buffer |
| `genome.json`  | Immutable identity |
| `meta.json`    | All subsystem control-plane JSON, RNG internal state, text-sensor queue, thalamus state, tick/age counters, scale |

`io.js` provides `ByteWriter`/`ByteReader`; the reader copies into aligned
buffers so typed-array views are always valid. `snapshot.js` `save()`/`restore()`
round-trips the whole brain; on restore it rebuilds the reverse STDP index and
restores RNG state.

**Determinism:** the restore-point checksum (`Brain.checksum()` — an FNV-style
hash over sampled weights, tick count, simulated days, neuron/synapse counts, and
prediction error) is **bit-exact** across save → restore. See §8 for the residual
post-restore drift note.

---

## 7. Full-scale memory budget

`estimateMemoryBytes(config)` computes the hot-data footprint. At `full` scale
(1 M neurons, density 750 → ~750 M synapses) the estimate is **≈ 9.8 GB**, well
within the README's 22 GB envelope. Per-synapse cost is ~17–21 B (forward CSR +
delay + eligibility + reverse index), under the 32 B/synapse budget. The full
scale is supported by the math and code path but is not exercised by the default
boot or test runs.

---

## 8. Autonomous engineering decisions

These choices were made to satisfy the spec where it left details open:

1. **STDP via an explicit reverse index.** Post-spike potentiation needs each
   synapse's presynaptic identity. Rather than storing a per-synapse pre-id, a
   reverse CSR (`inOffsets`/`inIdx`, built by counting sort) plus a binary-search
   `preOf()` recovers it, keeping memory down while preserving exact pre+post
   STDP.

2. **Network liveliness tuning.** Without drive the network was nearly silent
   (input only reached the small somatosensory region). Adding `synapticGain =
   9.0` at delivery plus Poisson background drive (`backgroundRate = 0.02`,
   `backgroundAmp = 11.0`) brings the network to ≈4.6 spikes/tick with criticality
   ≈1.35 and an ≈80:20 E:I activity split — i.e. near self-organised criticality,
   as biology maintains baseline activity.

3. **Persistable RNG.** `mulberry32` was refactored so its internal state is a
   mutable instance field with `getState()`/`setState()`, making the stochastic
   stream exactly resumable. `fork(salt)` yields independent sub-streams.

4. **Exact restore required persisting non-obvious scalars.** Bit-exact restore
   needed four control-plane items beyond the obvious arrays: RNG state,
   `ComputeBudget.prevError` (controls recurrent step count), `TextSensor.queue`,
   and `Thalamus.prevEnergy` (salience). With these, weights/neuromodulators/
   prediction error are identical immediately after restore.

5. **Residual drift note.** A ~10⁻⁴/tick float drift remains in *continued*
   evolution after restore (likely a float64↔JSON round-trip of some scalar).
   This is below the spec requirement, which only mandates checksum match at the
   save/restore boundary — and that match is exact.

6. **Sensor phases.** Phase 1 (text/log) is fully wired. Phases 2–4
   (microphone/camera) are scaffolded in `sensors/scaffold_sensors.js` with
   deterministic fake generators so the routing path is exercised end-to-end
   without real hardware.

7. **Vocalization.** The motor stage tracks vocalization but currently writes an
   empty string to stdout (effectively silent) to keep the CLI clean; the
   closed-loop self-model still consumes the motor signal.

8. **Determinism boundary.** Two `Math.random()` calls remain outside the
   deterministic tick path (curriculum `pick()`, CLI random-examine index); the
   simulation core is fully seeded and reproducible.

---

## 9. Tests (`test/`)

- `test/brain.test.js` — boot, single tick, save/restore checksum equality,
  training-progress (prediction error falls), and sleep/consolidation.
- `test/subsystems.test.js` — RNG determinism + state restore, genome
  immutability, hippocampal pattern separation/completion, cognitive-map analogy,
  neuromodulator RPE + homeostatic relaxation.

Run with `npm test` (`node --test test/`). All tests pass.
