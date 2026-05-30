```
 ┏━━┓             
 ┣━━┻┓╻   ╻┏━━━╸
 ┃   ┃┃   ┃┃  ╺┓
 ┗━━━┛┗━━━┛┗━━━┛
```

# Bug - A digital brain

A reasonably complete model of the human brain that can;
- See (computer camera)
- Hear (computer microphone)
- Generate sound (computers spakers)
- Touch (std out, log to console)
- Feel (std in, keyboard keystrokes)
- Remember everything between sessions.

## Overview

The project's goal is **a structurally honest digital brain**: an always-on simulation organised along the same coarse principles as a biological mammalian brain, embodied through ordinary computer peripherals so that it has real, continuous sensory and motor channels.

Embodiment maps the human senses onto hardware the way a small animal might experience a desktop:

| Sense (human) | Channel (machine) |
|---|---|
| Vision | Computer camera |
| Hearing | Computer microphone |
| Speech / vocalisation | Computer speakers |
| Touch (external surface contact) | Standard output / log lines it can "feel" being emitted |
| Proprioception / interoception (inner signal) | Standard input / keyboard keystrokes |

These channels are not decorative — per the embodied-cognition literature reviewed at the bottom of this document, the *shape* of the I/O interface determines which concepts can be learned at all, so they are treated as constitutive parts of the brain, not as afterthoughts attached to a "core" model.

Above this body sits a network of interacting subsystems modelled on what is currently known about the human brain: Dale's-Law excitatory and inhibitory populations, glia-like metabolic support, multiple anti-correlated intrinsic networks (default-mode / action-mode / salience), a two-system sensory router, predictive-coding loops, a hippocampal pattern-separation stage, oscillatory binding, neuromodulatory broadcast channels, a slow epigenetic-style regulatory layer, and a self-monitoring complexity signal. The full target architecture is enumerated in *Core Brain-Inspired Principles* and *Initial Target & Implementation Plan* below.

The brain **remembers everything between sessions**: synaptic weights, episodic traces, neuromodulator set-points, developmental age, and the slow regulatory state are all persisted to disk and reloaded on startup so that the same individual continues to exist across runs.

## Persistent state

A digital brain that forgets everything on shutdown is not a brain. The full system state is snapshotted to a structured on-disk store and reloaded on startup, covering:

- All synaptic weights (E and I populations)
- Episodic / hippocampal traces with their cross-modal bindings
- Neuromodulator set-points and current affect/mood state
- Slow epigenetic regulatory layer
- Developmental age and lifetime statistics
- Working-memory geometric buffer contents at shutdown
- Cognitive-map (grid/place-cell) coordinates over the concept space

Saves happen on a timer during operation and on graceful shutdown; the brain reloads itself on startup as the same individual it was before.

## Subsystems

Each subsystem below corresponds to one or more principles in *Core Brain-Inspired Principles* and is justified by one or more entries in the source list.

### Body / embodiment
- **Visual cortex stub** — frame grabs from the camera, processed along a two-system pathway (content + salience).
- **Auditory cortex stub** — short rolling buffer from the microphone, with both content and onset-salience channels.
- **Vocal motor stub** — generates audio to the speakers.
- **Tactile / proprioceptive stubs** — interpret stdout writes and stdin keystrokes as somatic signals.

### Sensory routing
- Every modality is dispatched along **two parallel paths**: a content-preserving *lemniscal* path and a diffuse *extralemniscal* salience path, mirroring the two-system theory of sensory-evoked responses. Novel or sudden inputs trigger global state changes even when their content is weak.

### Cortical microcircuit
- **Dale's-Law populations**: every unit is strictly excitatory (glutamatergic-like) or strictly inhibitory (GABAergic-like). The global E/I ratio is a first-class system parameter, monitored via an aperiodic-1/f-like spectrum of the firing trace.
- **Mixed-selectivity, distributed concept storage** — no grandmother cells.
- **Dendritic / multi-compartment computation** with non-linear summation per unit.
- **Specialised long-range "shortcut" cells** (Von Economo–style) providing fast, gradient-stable highways between distant modules.

### Glia
- An **astrocyte-like resource pool** diffuses metabolic "fuel" through the network, gating and stabilising persistent activity (working-memory bumps, attractor states) independently of synaptic weight.

### Memory systems
- **Working memory** — a small, bounded buffer encoding recent items as positions on a low-dimensional manifold so that sequence and hierarchy are preserved.
- **Hippocampal pattern-separation/completion** — new episodes are orthogonalised against existing memory before being written; later retrieval can pattern-complete from a partial cue.
- **Cross-modal engrams** — every memory trace can be reactivated from any of its constituent modalities; dopamine-gated bridging governs which modalities get linked.
- **Semantic / conceptual memory** — long-term distributed representations, distinct from episodic traces.
- **Cognitive map of concepts** — a grid-/place-cell-style relational map over the concept space (not just physical space), enabling analogy and transfer.

### Plasticity
- **Predictive coding everywhere** — every layer predicts its own next input and propagates only the prediction-error residual upward.
- **Reward-prediction-error gated plasticity** (dopamine-like global scalar) as a special case of the above.
- **Sparse coding + temporal-dynamics regularisation** to prevent catastrophic forgetting during lifelong learning.
- **Critical-period / developmental schedule** — high plasticity early in a lifetime, gradual consolidation, senescence-style pruning later.
- **Sleep / offline replay** phase with adjustable replay speed to consolidate recent traces.
- **Epigenetic-style slow regulatory layer** that changes *which* plasticity rules are active over long timescales.

### Macroscale dynamics
- **Co-existing intrinsic networks**: default-mode (idle/spontaneous thought), action-mode (task engagement), salience (arbiter) and a frontoparietal-style control network, dynamically switched and anti-correlated.
- **Explicit oscillatory bands** (theta/alpha/beta/gamma analogues) and phase-coupling as a binding mechanism — concepts firing in the same phase are treated as bound into a single percept.
- **Higher-order (hypergraph / simplicial) connectivity**, not just pairwise edges, with brain-flow decomposition into divergence / gradient / curl.
- **Criticality / edge-of-chaos** operating regime tracked as a health metric.

### Neuromodulation & affect
- Global broadcast channels analogous to **dopamine, serotonin, noradrenaline, acetylcholine and cortisol** rescale plasticity, gain, exploration and stress-driven consolidation — providing the "mood" layer that gates how strongly experiences are written to memory.
- **Homeostatic drive variables** (energy, novelty, social) generate intrinsic goals.

### Self-modelling & control
- **Closed action-perception loop** — the brain models its own outputs and their consequences, not just inputs.
- **Brain-complexity / synergistic-self-information monitor** — a formally computable internal observable for "how rich is the current thought".
- **Bounded compute budget per thought** — explicit limits on breadth × depth × recurrent steps, traded off against expected information gain.
- High-level control flow staged as a **Detect → Integrate → Mark → Execute** pipeline (DIME / functional-whole-brain-model style), so that perception, memory, valuation and conscious access have explicit phases rather than being hidden in a single event loop.

### Individual variation
- A small immutable **"genome"** of initial parameters interacts with the input stream to produce individual differences and constrains the "decisional space" available to the agent.

## Installation & Usage

1. **Run the brain:**
   ```bash
   npm start
   ```

2. **Interact through the available channels.** Type into stdin to feed the somatic/keyboard channel; observe stdout for the tactile trace and any vocalisations. As phases 2–4 of the sensor rollout come online (see *Initial Target & Implementation Plan* below), the microphone, speakers, and camera channels become active.

3. **Introspect:**
   - `stats` — current network statistics, E/I ratio, developmental age, complexity signal.
   - `examine` — inspect individual units, their populations (E or I), and their participation in engrams.
   - `save` — manually flush persistent state.
   - `sleep` — enter offline replay / consolidation phase explicitly.
   - `exit` — graceful shutdown (state is saved).

## How It Works

### Core loop

The brain runs a continuous **Detect → Integrate → Mark → Execute** cycle:

1. **Detect** — sensory channels (camera, microphone, stdin, …) emit signals along both lemniscal (content) and extralemniscal (salience) paths.
2. **Integrate** — cortical microcircuits combine current sensory input with predictions from higher layers (predictive coding), propagating only prediction-error residuals upward. Oscillatory phase binds co-firing units into momentary percepts.
3. **Mark** — neuromodulators tag the current activation pattern with valence and salience; the hippocampal stage decides whether to write a new episodic trace (after pattern-separation) and which existing engrams to broaden across modalities.
4. **Execute** — the action-mode network selects an output via the motor channels (speakers, stdout, …), under bounded compute budget; the closed-loop monitor records the consequences of that output to refine future predictions.

Between input bursts the default-mode network takes over and produces spontaneous activity, supporting "thinking at rest", and during long idle intervals a sleep/replay phase consolidates recent episodic traces into the semantic store.

### Persistence

State is continuously snapshotted to disk so the same individual brain resumes on the next launch, with its synapses, episodic memories, mood, developmental age, and slow regulatory state intact.

### Development over a lifetime

The brain has an internal age. Early on it sits in a high-plasticity "critical period" where almost any input reshapes connectivity; over time, myelination-like consolidation slows plasticity and stabilises personality; in late life, pruning dominates and the network becomes sparser but more efficient. Educational / pedagogical input (structured curricula at the keyboard channel) is logged separately so its effect on the developmental trajectory can be studied.

## Expected observations

As the brain runs over many sessions:
- Sensory representations should converge on sparse, predictive codes (predictive-coding signature).
- Distinct intrinsic networks should become detectable as anti-correlated activity clusters.
- The E/I ratio and aperiodic spectrum should drift along a developmental trajectory comparable to published "brain charts".
- Cross-modal engrams should make a single modality sufficient to retrieve multimodal experiences.
- The internal complexity / synergistic-self-information signal should track engagement vs. idle / sleep states.

## Philosophy

The position taken here is that **a credible digital brain must take the actual architecture of biological brains seriously** — Dale's Law, glia, intrinsic networks, the two-system sensory split, predictive coding, hippocampal pattern separation, neuromodulation, oscillatory binding, embodiment — and that any one of these omitted is a known failure mode rather than a harmless simplification.

The target is *not* a human brain. It is a non-human but structurally honest brain model: every major subsystem corresponds to a mechanism with substantial empirical support in the cited literature, and the code is judged against that literature rather than against surface behaviour.

## Core Brain-Inspired Principles

The intended logic of the system, distilled from the literature review at the bottom of this document, is:

1. **Excitation/Inhibition (E/I) balance.** Two opposing populations — excitatory (glutamatergic) and inhibitory (GABAergic) — co-evolve. Learning rate, plasticity windows and "creativity" are tuned by the E/I ratio rather than by raw excitation alone. Aperiodic (1/f) statistics of the global firing trace are used as a proxy for current E/I state.
2. **Distributed, mixed-selectivity representations.** Concepts are not stored in a single neuron but in distributed activity patterns across many units, with individual units participating in multiple concepts (mixed selectivity), supporting abstract rule encoding.
3. **Intrinsic networks (DMN + action-mode + salience).** The network maintains several always-on, anti-correlated sub-networks: a *default-mode* network that generates spontaneous thought during idle periods, an *action-mode* network that engages on input, and a *salience* network that arbitrates between them.
4. **Two-system sensory routing.** Every input is dispatched along two paths: a *lemniscal* modality-specific path (preserves content) and a diffuse *extralemniscal* salience path (signals "something happened"), so novel or sudden inputs trigger global state changes even when their content is weak.
5. **Reward prediction error (RPE) reinforcement.** A scalar dopamine-like signal compares expected vs. actual outcome of an action and gates plasticity.
6. **Geometric working memory.** A small, bounded working-memory buffer encodes recent items as positions in a low-dimensional manifold so that sequence and hierarchy are preserved.
7. **Neuromodulation & affect.** Global scalars analogous to dopamine, serotonin, noradrenaline and cortisol modulate plasticity, exploration, attention and stress-driven consolidation — providing the "mood" layer that gates how strongly experiences are written to memory.
8. **Epigenetic / slow-regulatory layer.** A slow timescale of "gene-like" regulatory state (inspired by lncRNA / chromatin modulation) sits above synaptic weights and changes which plasticity rules are active, producing developmental phases and trait-like stability.
9. **Embodied I/O.** Sensory and motor channels are treated as constitutive of cognition, not as afterthoughts; the shape of the I/O channel shapes which concepts can form (embodied-cognition principle).
10. **Lifespan / developmental trajectory.** The network has age-dependent parameters: a high-plasticity "critical period" early in a lifetime, gradual myelination-like consolidation, and senescence-style pruning later.
11. **Genetics × environment.** A small immutable "genome" of initial parameters interacts with the input stream to produce individual differences and constrains the "decisional space" available to the agent.
12. **Behaviour-coupled learning.** The system models its own outputs and their downstream effects on inputs, so learning is driven by the brain-behaviour loop, not just by passive observation.
13. **Dale's-Law populations + glial support.** Units obey Dale's Law (purely E or purely I), and a separate astrocyte-like resource layer diffuses metabolic "fuel" that sustains persistent activity (working-memory bumps, attractor states) independently of synaptic weight.
14. **Oscillatory binding.** Multiple coexisting rhythms (theta/alpha/beta/gamma analogues) provide a *temporal coordinate system*; units that fire in the same phase are treated as bound into a single percept.
15. **Hippocampal pattern-separation/completion + cross-modal engrams.** New episodes are first orthogonalised against existing memory before being written; later retrieval can pattern-complete from any single modality back to the full multimodal trace.
16. **Predictive coding everywhere.** Every layer continually predicts its own next input and only propagates the prediction-error residual upward; reward-prediction-error becomes a special case of a general principle.
17. **Cognitive map of concepts.** A grid-/place-cell-style relational map is maintained over the *concept space* (not just physical space), enabling analogy, interpolation and transfer between domains.
18. **Sparse, energy-aware coding.** Activity is kept sparse and temporally structured both to mirror biological energy budgets and to avoid catastrophic forgetting during lifelong learning.
19. **Bounded compute budget per thought.** Each inference step has an explicit budget in breadth × depth × recurrent steps, traded off against expected information gain — mirroring metabolic limits.
20. **Self-monitoring of complexity / integration.** The system continuously measures its own network complexity and a synergistic-self-information signal as internal observables — a formal proxy for "how rich is the current thought?".
21. **Reference architecture (DIME / functional whole-brain model).** The high-level control loop is staged as **Detect → Integrate → Mark → Execute** (or an equivalent fWBM template) so that perception, memory, valuation, and conscious access have explicit phases rather than being implicit in a single event loop.

## Technical Details

- **Language**: JavaScript (Node.js).
- **Concurrency**: Multiple concurrent loops at different rates — fast neural tick, slower neuromodulator update, much slower epigenetic / developmental update, asynchronous sleep/replay.
- **I/O channels**: camera (vision), microphone (audition), speakers (vocal motor), stdout (tactile/external), stdin (proprio/interoceptive).
- **State**: structured on-disk snapshot covering synapses, episodic traces, neuromodulator set-points, developmental age, epigenetic layer, cognitive map, working-memory buffer.
- **Performance**: not a goal at this stage; correctness against the cited literature is.

## Initial Target & Implementation Plan

### Hardware envelope

- Workstation RAM: **36 GB**, cap at **75 % → 27 GB**
- Reserve ~5 GB for Node/OS, sensor buffers, episodic store, headroom
- **Working budget for neurons + synapses: ~22 GB**

### Initial scale ("honey-bee tier")

| Item | Count | Storage |
|---|---|---|
| Neurons (functional Izhikevich-class, 64 B each) | **~1,000,000** | ~64 MB |
| Synapses (sparse, 32 B each — weight + delay + STDP trace + type) | **~700,000,000** | ~22 GB |
| Glia (one scalar resource value per cell, 16 B) | ~1,000,000 | ~16 MB |
| Neuromodulator broadcast bus (5 channels × per-region histograms) | 5 × ~100 regions | ~negligible |
| Episodic store (sparse engram patterns) | grows over life, capped at ~500 MB | ~0.5 GB |
| Working-memory geometric buffer | ~10 KB | negligible |
| **Total at boot** | | **~22.5 GB** |

This is approximately the scale of a honey-bee brain (~960 K neurons, ~10⁹ synapses) — biologically meaningful, well-studied, and the smallest scale where every architectural principle in this README is genuinely exercisable rather than caricatured.

### Region / population layout

The 1 M neurons are partitioned into named regions, each with a fixed E:I ratio (80:20 unless noted) and a within- vs between-region connection probability. Numbers below are starting allocations; they should be tunable per run.

| Region (analogue) | Neurons | Role |
|---|---|---|
| V1 visual cortex stub | 150 K | Camera input, Gabor-like predictive features |
| A1 auditory cortex stub | 80 K | Microphone input, cochlea-filterbank features |
| Somatosensory (stdin/stdout) | 50 K | Keyboard / log-line signals |
| Thalamus (two-system router) | 40 K | Lemniscal + extralemniscal split for every modality |
| PFC (rules, abstract categories) | 120 K | Mixed-selectivity, abstract-rule encoding |
| PPC (sequence geometry) | 80 K | 2-D neural geometry working memory |
| Hippocampus (DG / CA3 / CA1) | 80 K | Pattern separation + completion, episodic write |
| Striatum / basal ganglia | 60 K | Action selection, RPE gating |
| Cerebellum stub | 150 K | Timing, fine motor prediction |
| Motor cortex | 50 K | Speaker / stdout drive |
| DMN + salience + control nets | 80 K | Intrinsic networks, spontaneous thought |
| Brainstem neuromod nuclei | 10 K | DA / 5-HT / NE / ACh / cortisol broadcast |
| Cross-region long-range (Von Economo-like) | 50 K | Shortcut highways between distant regions |
| **Total** | **1,000 K** | |

### Baseline state (first ever boot)

1. **Genome** — fix a master RNG seed plus a handful of macro params (E:I ratio bias, exploration baseline, plasticity decay) and freeze them to disk. This becomes the immutable individual identity.
2. **Connectivity** — instantiate sparse synapses by drawing from a region × region connection-probability matrix (a coarse "connectome prior"). Within-region density high; between-region density per the prior; long-range shortcut cells preferentially wire distant high-degree regions.
3. **Cell types** — assign each neuron an Izhikevich class (RS / FS / LTS / IB) by region-specific distribution; E vs I population fixed at birth (Dale's Law).
4. **Weights** — `~N(0, 0.1)`, clipped to `[w_min, w_max]`; biases zero.
5. **Neuromodulators** — set all five to homeostatic midpoint.
6. **Glia** — resource pool at uniform full level.
7. **Developmental age** = 0; plasticity-rate multiplier = max.
8. **Episodic + semantic stores** — empty.
9. **Snapshot** to disk; this is "birth".

Every subsequent boot restores the snapshot rather than re-initialising.

### How learning is accomplished

Plasticity is **layered** — multiple rules act on the same synapses at different timescales:

1. **Predictive coding (fast, always-on).** Every region predicts its own next input from its current state + top-down prior; only the residual propagates upward. Local Hebbian update scaled by `|prediction_error| × current_DA`.
2. **STDP (fast, within-region).** Spike-timing-dependent plasticity does the fine tuning; ±20 ms window.
3. **Reward-prediction-error (event-driven, global).** Dopamine spikes when actual outcome ≠ expected; rescales recent eligibility traces globally.
4. **Hippocampal write (event-driven).** When salience or surprise crosses a threshold, the dentate-gyrus stage orthogonalises the current cortical state and writes it as a sparse engram. Cross-modal engrams broaden when multiple sensory channels fire together under DA gating.
5. **Sleep / replay (offline, fast).** Between sessions (or on `sleep`), the DMN replays high-salience hippocampal traces at 10–50× into the semantic network — this is where short-term episodes are baked into long-term structure.
6. **Epigenetic update (very slow).** Once per simulated "day", the slow regulatory layer adjusts which plasticity rules are active and their gains (e.g., critical-period plasticity decays with age).

Reward is mostly **intrinsic**: prediction-error reduction and novelty drive a dopamine baseline. Extrinsic reward comes from the curriculum scheduler (see below) or the human user.

### Sensors: phased rollout

| Phase | Channels added | Why this order |
|---|---|---|
| **1 (now)** | `stdin` (text), `stdout` (own tactile echo) | Already wired, fully automatable, no driver work |
| **2** | Microphone (16 kHz mono → 64-band cochlea filterbank → 100 Hz spectral frames) | Adds temporal structure cheaply; small CPU cost; large public datasets |
| **3** | Speakers (motor cortex spikes → simple vocoder) | Closes the audio loop and enables vocalisation / self-listening |
| **4** | Camera (320×240 grayscale @ 10 fps → V1 Gabor pyramid) | Highest compute cost; benefits from already-trained attention scaffolding |

Each new modality plugs into both arms of the **thalamic two-system router** (content + salience) and gets its own engram column in hippocampus.

### Per-session lifecycle

Each "wake" session runs the **Detect → Integrate → Mark → Execute** loop:

1. **Boot** — restore snapshot; neuromodulators returned to homeostatic baseline (some carry-over of mood permitted).
2. **Wake** — sensors opened; main DIME loop runs at the native tick rate.
3. **Engagement** — automated curriculum and/or human input feeds the senses.
4. **Mark** — salient/surprising events tagged for hippocampal write.
5. **Sleep** — explicit or end-of-session: sensors closed, DMN takes over, replays the day's marked traces at 10–50× into the semantic store; epigenetic layer ticks one step.
6. **Snapshot** — full state to disk.

### Automating interactions for faster-than-real-time learning

A 36 GB workstation can run this brain **faster than wall-clock** if real-time sensors are not the bottleneck. Five stacked techniques:

1. **Decouple from wall clock.** The tick rate is internal. Wake phase, with real sensors disconnected and only synthetic input, should run at ~10–100× brain-time-per-wall-second on this hardware. Sleep/replay (no sensors at all) at ~100–1000×.
2. **Synthetic curriculum (the main lever).** A `curriculum/` module feeds canned input streams instead of waiting for a human:
   - Text corpora streamed into stdin at controllable rate (Wikipedia, books, conversation logs).
   - Audio datasets (LibriSpeech, AudioSet, environmental sound) replayed into the mic channel.
   - Video datasets or procedurally-generated scenes into the camera channel.
   - Each curriculum item carries an extrinsic-reward tag for RPE plasticity.
3. **Self-supervised intrinsic reward.** Predict-next-frame / predict-next-token error directly drives dopamine, so the brain trains itself even with no labels and no human.
4. **Dreaming / parallel branches.** During sleep, the DMN can fork N parallel imagined experiences over the shared synaptic substrate, each replaying or recombining stored engrams; the consolidations are averaged back. Cheap because no sensor I/O.
5. **Slow-clocks for slow processes.** Neuromodulator dynamics update every ~10⁴ ticks; epigenetic state every ~10⁷ ticks — these never bottleneck the main loop.

**Concrete near-term target:** with phase-1 sensors + a text curriculum + sleep replay, aim for **1 simulated day per wall-clock hour** at the honey-bee scale (≈ 24× real-time). Once vision/audio are added (phases 2–4), real-time learning becomes the constraint during wake and offline replay still dominates throughput.

### Module / filesystem layout

```
src/
  core/             tick loop, scheduler, DIME stages
  genome/           immutable per-individual seed + macro params
  populations/      Izhikevich neurons (E and I), dendritic ops
  regions/          region definitions + region×region connectome prior
  synapses/         sparse synapse store, STDP, eligibility traces
  glia/             astrocyte resource diffusion
  modulators/       DA / 5-HT / NE / ACh / cortisol broadcast buses
  thalamus/         two-system sensory router
  hippocampus/      pattern-sep, episodic store, replay engine
  sensors/          stdin, microphone, camera adapters
  motors/           stdout, speakers
  intrinsic_nets/   DMN, salience, action-mode, control
  monitor/          E/I ratio, aperiodic spectrum, complexity, USK signal
  persist/          snapshot / restore / migrations
  curriculum/       synthetic teachers, datasets, schedulers
  cli/              stats / examine / save / sleep / exit
```

### Build order (concrete, ties back to the roadmap)

1. **Scaffold + persist** — `core` tick loop, `genome` freeze, `persist` snapshot.
2. **Populations + sparse synapses** at ~10⁵ neurons; validate Dale's-Law E/I, STDP, E/I-ratio monitor.
3. **Scale up** to ~10⁶ neurons / ~10⁹ synapses; confirm 22 GB envelope holds.
4. **Sensors phase 1** + thalamic router + somatosensory region; first end-to-end Detect→Execute on text.
5. **Hippocampus + episodic engrams + sleep/replay**; first lifetime consolidation experiment.
6. **Neuromodulators + RPE plasticity + intrinsic networks**; brain switches between active and resting modes correctly.
7. **Curriculum module + automation harness**; verify 24× real-time learning on text.
8. **Sensor phase 2 (microphone)**, then phase 3 (speakers), then phase 4 (camera) with V1 stub.
9. **Glia, oscillatory bands, cognitive map, complexity monitor** — the "nice to have but architecturally required" layer.
10. **Epigenetic / developmental schedule** — the slowest clock.

This sequence keeps the system runnable and observable at every step, and never asks for more than 22 GB.

---

*"A digital brain has to be judged against what biological brains actually do — not against how interesting its own surface behaviour looks."*

## Sources on how the human brain works

Each source below has been reviewed; the bullet under each entry records the concept extracted and incorporated into the *Core Brain-Inspired Principles* and *Initial Target & Implementation Plan* sections above.

- [x] **Cohen Kadosh, R. (2025). _Rethinking excitation/inhibition balance in the human brain._ Nat. Rev. Neurosci. 26, 451–452.** — https://www.nature.com/articles/s41583-025-00943-0
  - *Concept incorporated:* E/I balance as a first-class system parameter; aperiodic-spectrum proxy for E/I; need for explicit inhibitory population.
- [x] **Roy, B. et al. (2025). _Deciphering the epigenetic role of long non-coding RNAs in mood disorders._ Clin. Transl. Med. 15.** — https://onlinelibrary.wiley.com/doi/abs/10.1002/ctm2.70135
  - *Concept incorporated:* Slow epigenetic regulatory layer above synaptic weights; mood-state gating of plasticity and synaptic function.
- [x] **Cross, Z. R. et al. (2025). _The development of aperiodic neural activity in the human brain._ Nat. Hum. Behav. 9, 2548–2563.** — https://www.nature.com/articles/s41562-025-02270-x
  - *Concept incorporated:* Periodic vs. aperiodic decomposition of background activity; developmental trajectories ("brain charts") and age-dependent parameters.
- [x] **Mathis, M. W. & Mathis, A. (2026). _Joint modelling of brain and behaviour dynamics with artificial intelligence._ Nat. Rev. Neurosci. 27, 87–100.** — https://www.nature.com/articles/s41583-025-00996-1
  - *Concept incorporated:* Closed brain-behaviour loop; the model must model its own outputs and their consequences, not just inputs.
- [x] **Șerban, I. V. (2025). _Neuroscience, Genetics, Education, and AI: Charting New Frontiers in Understanding Human Behaviour and Criminal Responsibility._ BRAIN.** — https://brain.edusoft.ro/index.php/brain/article/view/1781
  - *Concept incorporated:* Genetics × environment × education shaping behaviour; "decisional space" as a constraint on agent choice; hooks for pedagogical intervention.
- [x] **(Edited volume on human brain & behaviour, Google Books).** — https://books.google.com/books?id=TOLKEQAAQBAJ
  - *Concept incorporated:* General textbook framing — distinct memory systems (working / episodic / semantic) and the need to separate them in any honest model.
- [x] **Rosen, M. C. & Freedman, D. J. (2026). _How distributed is the brain-wide network that is recruited for cognition?_ Nat. Rev. Neurosci. 27, 138–150.** — https://www.nature.com/articles/s41583-025-00992-5
  - *Concept incorporated:* Cognition is brain-wide and distributed; mixed-selectivity units; abstract-rule encoding across PFC + parietal analogues.
- [x] **Girgenti, M. J. et al. (2025). _Single-cell chromatin landscape of the dorsolateral prefrontal cortex in PTSD._ Nature.** — https://www.nature.com/articles/s41586-025-09083-y
  - *Concept incorporated:* Cell-type-specific regulation; stress / glucocorticoid signalling as a learning-gating channel; neuroimmune crosstalk affecting plasticity.
- [x] **(2025). _Unravelling the origin of reward positivity: a human intracranial event-related study._ Brain 148(1), 199–211.** — https://academic.oup.com/brain/article-abstract/148/1/199/7727398
  - *Concept incorporated:* Explicit reward-prediction-error signal driving plasticity (dopamine-like global scalar) instead of any-activity reinforcement.
- [x] **Fan, Y. et al. (2024). _Two-dimensional neural geometry underpins hierarchical organization of sequence in human working memory._ Nat. Hum. Behav. 9, 360–375.** — https://www.nature.com/articles/s41562-024-02047-8
  - *Concept incorporated:* Bounded working-memory buffer with low-dimensional geometric structure preserving order and hierarchy.
- [x] **Somervail, R. et al. (2026). _A two-system theory of sensory-evoked brain responses._ Brain 149(5), 1438–1451.** — https://academic.oup.com/brain/article-abstract/149/5/1438/8300057
  - *Concept incorporated:* Two parallel sensory pathways — content-preserving lemniscal + diffuse salience extralemniscal — feeding every input.
- [x] **Dosenbach, N. U. F., Raichle, M. E. & Gordon, E. M. (2025). _The brain's action-mode network._ Nat. Rev. Neurosci. 26, 158–168.** — https://www.nature.com/articles/s41583-024-00895-x
  - *Concept incorporated:* Multiple anti-correlated intrinsic networks (default-mode, action-mode, salience); spontaneous thought as a first-class mode, not noise.
- [x] **Williamson, B., Pykett, J. & Kotouza, D. (2026). _Learning brains: educational neuroscience, neurotechnology and neuropedagogy._ Pedagogy, Culture & Society 34(2), 515–535.** — https://www.tandfonline.com/doi/abs/10.1080/14681366.2025.2521458
  - *Concept incorporated:* Learning is shaped by structured, social/pedagogical input — motivates explicit "teaching" interventions and curriculum-style input scheduling.
- [x] **Barton, R. & Barrett, L. (2025). _Embodied cognitive evolution and the limits of convergence._ Phil. Trans. R. Soc. B 380(1929), 20240255.** — https://royalsocietypublishing.org/rstb/article-abstract/380/1929/20240255/235015
  - *Concept incorporated:* Cognition is embodied; the shape of the sensory-motor interface constrains which concepts can be learned — I/O is not a neutral pipe.
- [x] **Zeng, Y. et al. (2023). _BrainCog: A Spiking Neural Network based Brain-inspired Cognitive Intelligence Engine for Brain-inspired AI and Brain Simulation._** — https://arxiv.org/abs/2207.08533
  - *Concept incorporated:* Reference layered architecture stacking spiking primitives → microcircuits → cognitive functions; template for organising future modules in this project.
- [x] **Senden, M. et al. (2026). _Functional Whole-Brain Models: A New Framework for Unifying Brain Structure and Cognitive Function._** — https://arxiv.org/abs/2605.18118
  - *Concept incorporated:* Adopt the **fWBM** four-criterion target (structural grounding, dynamical realism, functional competence, mappable observables) as the project's north star.
- [x] **Shilova, K. et al. (2026). _Exploratory Experience Shapes the Geometry of Predictive Representations._** — https://arxiv.org/abs/2605.27929
  - *Concept incorporated:* Explicit exploration↔exploitation knob; predictive-coding agent whose learned latent geometry depends on its behavioural regime.
- [x] **(2026). _A simple model of co-emergence of grid and place fields._** — https://arxiv.org/abs/2605.21356
  - *Concept incorporated:* Dale's Law (every unit strictly E or I); spatial cognitive map (grid + place cells) emerges from next-observation prediction without supervision.
- [x] **Okray, Z. et al. (2026). _Multisensory learning recruits visual neurons into an olfactory memory engram._** — https://arxiv.org/abs/2604.28007
  - *Concept incorporated:* Cross-modal engram broadening; dopamine-gated GABA release as a bridging mechanism so any single modality can later retrieve the full multimodal memory.
- [x] **Palmer, N. et al. (2026). _Astrocytic resource diffusion stabilizes persistent activity in neural fields._** — https://arxiv.org/abs/2604.10036
  - *Concept incorporated:* Distinct astrocyte / glia resource layer with diffusive recycling that gates and stabilises persistent (working-memory) activity.
- [x] **(2026). _Von Economo neurons enable reliable social skill acquisition in recurrent spiking neural networks._** — https://arxiv.org/abs/2605.17399
  - *Concept incorporated:* A small population of specialised "shortcut" cells provides direct gradient pathways that stabilise learning in deep recurrent circuits.
- [x] **(2026). _Learning sequence timing and control of replay speed in networks of spiking neurons._** — https://arxiv.org/abs/2605.22523
  - *Concept incorporated:* Sequence representations with explicit per-element timing and an adjustable replay-speed control — required for sleep-style consolidation.
- [x] **Mago, J. et al. (2026). _The Complex Brain Hypothesis: Resolving the Entropy-Content Conundrum in Minimal Phenomenal Experience._** — https://arxiv.org/abs/2605.16146
  - *Concept incorporated:* Track brain *complexity* (not just entropy) as a marker of phenomenal richness; distinguish fine-grained vs coarse-grained inference regimes.
- [x] **(2026). _Consciousness as Uncommon Self-Knowledge: A Synergistic Information Framework._** — https://arxiv.org/abs/2605.13884
  - *Concept incorporated:* Synergistic self-information (PID-derived) as a formally computable signature of integrated processing — usable as an internal observable.
- [x] **(2026). _Growing a Neural Network in Breadth, Depth, and Time._** — https://arxiv.org/abs/2605.25174
  - *Concept incorporated:* Resource-constrained architectural growth — explicit breadth × depth × recurrent-steps budget per thought, traded against accuracy.
- [x] **Bispo, B. C. et al. (2026). _Multimodal Higher-Order Brain Networks: A Topological Signal Processing Perspective._** — https://arxiv.org/abs/2603.29903
  - *Concept incorporated:* Move beyond pairwise edges to higher-order (hypergraph / simplicial) interactions, decomposing brain flows into divergence / gradient / curl.
- [x] **Sethi, D., Faraz, M. & Wong-Lin, K. (2026). _Multi-Objective Optimisation with Oscillatory Dynamics in Spontaneous and Decision Spiking Neural Networks._** — https://arxiv.org/abs/2605.25224
  - *Concept incorporated:* Oscillation frequencies are first-class fitting targets, not byproducts; Izhikevich-style E+I spiking populations are the right substrate.
- [x] **Shi, Q. et al. (2026). _Joint sparse coding and temporal dynamics support context reconfiguration._** — https://arxiv.org/abs/2605.10178
  - *Concept incorporated:* Sparse coding + temporal dynamics together prevent catastrophic forgetting in lifelong learning and yield an energy-efficient regime.
- [x] **(2026). _The DIME Architecture: A Unified Operational Algorithm for Neural Representation, Dynamics, Control and Integration._** — https://arxiv.org/abs/2603.12286
  - *Concept incorporated:* Adopt the **Detect → Integrate → Mark → Execute** staged pipeline as the project's coarse control flow, giving perception, memory, valuation and conscious access explicit phases.
