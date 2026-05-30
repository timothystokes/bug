'use strict';

// Macroscale dynamics: Higher-order (hypergraph / simplicial) connectivity with
// brain-flow decomposition into divergence / gradient / curl (Hodge-style).
// Source: Bispo et al. (2026) topological signal processing of higher-order
// brain networks. Operates on region-level activity (a coarse graph) so it is
// cheap regardless of neuron count.
class HigherOrder {
  constructor(config) {
    this.config = config;
    this.regions = config.regions;
    // Region adjacency (edges) derived from the connectome prior.
    this.edges = [];
    const idx = {};
    this.regions.forEach((r) => { idx[r.name] = r.index; });
    for (const src of Object.keys(config.connectomePrior)) {
      for (const dst of Object.keys(config.connectomePrior[src])) {
        if (idx[src] != null && idx[dst] != null && idx[src] < idx[dst]) {
          this.edges.push([idx[src], idx[dst]]);
        }
      }
    }
    this.divergence = 0;
    this.gradientEnergy = 0;
    this.curlEnergy = 0;
  }

  // Compute node potentials (region mean rates) and decompose the edge flow.
  analyse(populations) {
    const pot = new Float32Array(this.regions.length);
    for (const r of this.regions) {
      let s = 0;
      const step = Math.max(1, Math.floor(r.count / 2000));
      let cnt = 0;
      for (let i = r.start; i < r.end; i += step) { s += populations.rate[i]; cnt++; }
      pot[r.index] = cnt ? s / cnt : 0;
    }
    // Gradient flow on each edge = potential difference.
    let gradE = 0;
    let div = 0;
    const flow = new Float32Array(this.edges.length);
    for (let e = 0; e < this.edges.length; e++) {
      const [a, b] = this.edges[e];
      flow[e] = pot[b] - pot[a];
      gradE += flow[e] * flow[e];
    }
    // Divergence at nodes (net outflow).
    const net = new Float32Array(this.regions.length);
    for (let e = 0; e < this.edges.length; e++) {
      const [a, b] = this.edges[e];
      net[a] -= flow[e];
      net[b] += flow[e];
    }
    for (let i = 0; i < net.length; i++) div += Math.abs(net[i]);
    // Curl proxy: circulation around triangles (3-cliques) in the region graph.
    let curl = 0;
    const adj = this.adjacency();
    for (let i = 0; i < this.regions.length; i++) {
      for (const j of adj[i]) {
        if (j <= i) continue;
        for (const k of adj[j]) {
          if (k <= j || !adj[i].has(k)) continue;
          curl += Math.abs((pot[j] - pot[i]) + (pot[k] - pot[j]) + (pot[i] - pot[k]));
        }
      }
    }
    this.gradientEnergy = Math.sqrt(gradE);
    this.divergence = div;
    this.curlEnergy = curl;
    return this.snapshot();
  }

  adjacency() {
    if (this._adj) return this._adj;
    const adj = this.regions.map(() => new Set());
    for (const [a, b] of this.edges) { adj[a].add(b); adj[b].add(a); }
    this._adj = adj;
    return adj;
  }

  snapshot() {
    return { divergence: this.divergence, gradientEnergy: this.gradientEnergy, curlEnergy: this.curlEnergy };
  }
}

module.exports = { HigherOrder };
