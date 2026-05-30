'use strict';

// Principle 6: Geometric working memory. A small, bounded buffer encodes recent
// items as positions on a low-dimensional (2-D) manifold so that sequence and
// hierarchy are preserved. Source: Fan et al. (2024) two-dimensional neural
// geometry of sequence in working memory.
class WorkingMemory {
  constructor(capacity) {
    this.capacity = capacity;
    this.items = []; // { token, pos:[x,y], t }
    this.t = 0;
  }

  // Place a new item on the manifold. Order maps to angle; recency to radius, so
  // sequence (angle) and hierarchy/depth (radius) are both encoded geometrically.
  push(token) {
    this.t++;
    const angle = (this.items.length / Math.max(1, this.capacity)) * Math.PI * 2;
    const radius = 1.0; // newest on the rim
    this.items.push({ token, pos: [Math.cos(angle) * radius, Math.sin(angle) * radius], t: this.t });
    // Older items drift inward (consolidation/decay of position).
    for (const it of this.items) {
      it.pos[0] *= 0.92;
      it.pos[1] *= 0.92;
    }
    if (this.items.length > this.capacity) this.items.shift();
  }

  // Read the buffer ordered by sequence position.
  sequence() {
    return this.items.map((it) => it.token);
  }

  toJSON() {
    return { capacity: this.capacity, items: this.items, t: this.t };
  }

  load(obj) {
    if (!obj) return;
    this.capacity = obj.capacity || this.capacity;
    this.items = obj.items || [];
    this.t = obj.t || 0;
  }
}

module.exports = { WorkingMemory };
