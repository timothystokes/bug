'use strict';

const { RNG } = require('../util/rng');

// Principle 15: Hippocampal pattern-separation/completion + cross-modal engrams.
// New episodes are orthogonalised (dentate-gyrus expansion + k-WTA) against
// existing memory before being written; retrieval can pattern-complete from any
// single modality back to the full multimodal trace. Dopamine gates cross-modal
// broadening (Okray et al. 2026).
const CODE_DIM = 512;  // DG expansion dimension
const SPARSITY = 0.05; // fraction active after k-WTA

class Hippocampus {
  constructor(config, genome) {
    this.config = config;
    this.codeDim = CODE_DIM;
    this.k = Math.max(4, Math.floor(CODE_DIM * SPARSITY));
    // Input dimension = K slabs across cortical/associative regions.
    this.inDim = 64;
    // Fixed random projection (DG): seeded from genome so it is part of identity.
    const rng = new RNG((genome ? genome.seed : 1) ^ 0x5eed1);
    this.proj = new Float32Array(this.codeDim * this.inDim);
    for (let i = 0; i < this.proj.length; i++) this.proj[i] = rng.normal(0, 1);
    this.episodes = []; // { id, active:[...], modalities:[...], salience, tick, replays }
    this.nextId = 1;
    this.lastWriteTick = -1;
  }

  // Build an inDim feature vector from associative regions (PFC + Hippocampus + PPC).
  cortexVector(populations) {
    const vec = new Float32Array(this.inDim);
    const regs = ['PFC', 'Hippocampus', 'PPC', 'Somatosensory'];
    let d = 0;
    for (const name of regs) {
      const r = this.config.regions.find((x) => x.name === name);
      if (!r) continue;
      const per = Math.floor(this.inDim / regs.length);
      const slab = Math.max(1, Math.floor(r.count / per));
      for (let k = 0; k < per && d < this.inDim; k++, d++) {
        let s = 0;
        const base = r.start + k * slab;
        const end = Math.min(r.end, base + slab);
        for (let i = base; i < end; i++) s += populations.rate[i];
        vec[d] = s / Math.max(1, end - base);
      }
    }
    return vec;
  }

  // Pattern separation: project to high-dim and keep the top-k (k-WTA) -> sparse,
  // decorrelated code.
  separate(vec) {
    const code = new Float32Array(this.codeDim);
    for (let c = 0; c < this.codeDim; c++) {
      let s = 0;
      const base = c * this.inDim;
      for (let i = 0; i < this.inDim; i++) s += this.proj[base + i] * vec[i];
      code[c] = s;
    }
    // k-WTA: indices of the top-k activations.
    const idx = Array.from({ length: this.codeDim }, (_, i) => i);
    idx.sort((a, b) => code[b] - code[a]);
    return idx.slice(0, this.k).sort((a, b) => a - b);
  }

  overlap(a, b) {
    let i = 0;
    let j = 0;
    let common = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { common++; i++; j++; }
      else if (a[i] < b[j]) i++; else j++;
    }
    return common / Math.max(1, Math.min(a.length, b.length));
  }

  // Principle 15 + Mark stage: decide whether to write a new episode.
  maybeWrite(populations, salience, modalities, tick, neuromods) {
    const T = this.config.tunables;
    if (salience < T.hippoWriteThreshold) return null;
    const vec = this.cortexVector(populations);
    const code = this.separate(vec);

    // Novelty check: skip if too similar to an existing recent engram, else
    // dopamine-gated cross-modal broadening of the matched engram.
    let best = null;
    let bestOv = 0;
    for (let e = this.episodes.length - 1; e >= 0 && e > this.episodes.length - 50; e--) {
      const ov = this.overlap(code, this.episodes[e].active);
      if (ov > bestOv) { bestOv = ov; best = this.episodes[e]; }
    }
    if (best && bestOv > 0.7) {
      // Broaden existing engram across modalities under DA gating.
      if (!neuromods || neuromods.level.da > 0.45) {
        for (const m of modalities) if (!best.modalities.includes(m)) best.modalities.push(m);
        best.salience = Math.max(best.salience, salience);
      }
      return best;
    }

    const ep = {
      id: this.nextId++,
      active: code,
      modalities: modalities.slice(),
      salience,
      tick,
      replays: 0,
    };
    this.episodes.push(ep);
    this.lastWriteTick = tick;
    if (this.episodes.length > T.episodicCap) {
      // Forget the least salient, least replayed old episodes (graceful decay).
      this.episodes.sort((a, b) => (a.salience + a.replays * 0.1) - (b.salience + b.replays * 0.1));
      this.episodes.splice(0, this.episodes.length - T.episodicCap);
    }
    return ep;
  }

  // Pattern completion from a partial cue (e.g. a single modality's code).
  complete(cueCode) {
    let best = null;
    let bestOv = 0;
    for (const ep of this.episodes) {
      const ov = this.overlap(cueCode, ep.active);
      if (ov > bestOv) { bestOv = ov; best = ep; }
    }
    return best ? { episode: best, match: bestOv } : null;
  }

  // Principle: sleep/offline replay. Reinject high-salience engrams into the
  // cortical current to consolidate them into the semantic substrate.
  replayInto(populations, count) {
    if (this.episodes.length === 0) return 0;
    const sorted = this.episodes.slice().sort((a, b) =>
      (b.salience + b.replays * 0.05) - (a.salience + a.replays * 0.05));
    const pfc = this.config.regions.find((r) => r.name === 'PFC');
    let replayed = 0;
    for (let r = 0; r < Math.min(count, sorted.length); r++) {
      const ep = sorted[r];
      ep.replays++;
      replayed++;
      if (!pfc) continue;
      for (const c of ep.active) {
        const target = pfc.start + (c % pfc.count);
        populations.current[target] += 3.0;
      }
    }
    return replayed;
  }

  stats() {
    let totalReplays = 0;
    for (const e of this.episodes) totalReplays += e.replays;
    return { episodes: this.episodes.length, totalReplays, nextId: this.nextId };
  }

  toJSON() {
    return {
      nextId: this.nextId,
      lastWriteTick: this.lastWriteTick,
      episodes: this.episodes.map((e) => ({
        id: e.id,
        active: Array.from(e.active),
        modalities: e.modalities,
        salience: e.salience,
        tick: e.tick,
        replays: e.replays,
      })),
    };
  }

  load(obj) {
    if (!obj) return;
    this.nextId = obj.nextId || 1;
    this.lastWriteTick = obj.lastWriteTick != null ? obj.lastWriteTick : -1;
    this.episodes = (obj.episodes || []).map((e) => ({
      id: e.id,
      active: e.active,
      modalities: e.modalities,
      salience: e.salience,
      tick: e.tick,
      replays: e.replays || 0,
    }));
  }
}

module.exports = { Hippocampus, CODE_DIM };
