'use strict';

// Principle 17: Cognitive map of concepts. A grid-/place-cell-style relational
// map over the *concept space* (not just physical space), enabling analogy,
// interpolation and transfer. Concepts are embedded as 2-D coordinates; grid
// cells tile the space periodically; place cells fire near a learned location.
// Source: "co-emergence of grid and place fields" (2026).
class CognitiveMap {
  constructor(dim = 2, gridScales = [0.5, 1.0, 2.0]) {
    this.dim = dim;
    this.gridScales = gridScales;
    this.concepts = new Map(); // token -> { pos:[x,y], visits }
    this.lastPos = [0, 0];
  }

  // Embed/learn a concept location. New concepts get a position derived from the
  // previous one plus a learned offset (relational structure); repeats reinforce.
  observe(token) {
    let c = this.concepts.get(token);
    if (!c) {
      // Place near recent context with a hash-based offset (relational map).
      const h = hashStr(token);
      const off = [((h % 1000) / 1000 - 0.5), (((h >> 10) % 1000) / 1000 - 0.5)];
      c = { pos: [this.lastPos[0] + off[0], this.lastPos[1] + off[1]], visits: 0 };
      this.concepts.set(token, c);
    }
    c.visits++;
    // Drift toward running context centroid (interpolation/transfer).
    this.lastPos[0] += 0.1 * (c.pos[0] - this.lastPos[0]);
    this.lastPos[1] += 0.1 * (c.pos[1] - this.lastPos[1]);
    return c;
  }

  // Grid-cell activation vector at a position (periodic tiling across scales).
  gridCode(pos) {
    const code = [];
    for (const s of this.gridScales) {
      code.push(Math.cos(pos[0] / s) + Math.cos((pos[0] * 0.5 + pos[1] * 0.866) / s)
        + Math.cos((-pos[0] * 0.5 + pos[1] * 0.866) / s));
    }
    return code;
  }

  // Analogy: find the concept whose relational offset best matches a:b :: c:?
  analogy(a, b, c) {
    const A = this.concepts.get(a);
    const B = this.concepts.get(b);
    const C = this.concepts.get(c);
    if (!A || !B || !C) return null;
    const target = [C.pos[0] + (B.pos[0] - A.pos[0]), C.pos[1] + (B.pos[1] - A.pos[1])];
    let best = null;
    let bestD = Infinity;
    for (const [tok, cc] of this.concepts) {
      if (tok === a || tok === b || tok === c) continue;
      const d = (cc.pos[0] - target[0]) ** 2 + (cc.pos[1] - target[1]) ** 2;
      if (d < bestD) { bestD = d; best = tok; }
    }
    return best;
  }

  size() { return this.concepts.size; }

  toJSON() {
    return {
      dim: this.dim,
      gridScales: this.gridScales,
      lastPos: this.lastPos,
      concepts: Array.from(this.concepts.entries()).map(([k, v]) => [k, v]),
    };
  }

  load(obj) {
    if (!obj) return;
    this.dim = obj.dim || this.dim;
    this.gridScales = obj.gridScales || this.gridScales;
    this.lastPos = obj.lastPos || [0, 0];
    this.concepts = new Map(obj.concepts || []);
  }
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

module.exports = { CognitiveMap };
