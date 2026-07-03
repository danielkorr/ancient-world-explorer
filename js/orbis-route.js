// ═══════════════════════════════════════════════════════════
//  VIA — Ancient World Explorer
//  orbis-route.js — client-side routing over the ORBIS network
//
//  Runs Dijkstra in the browser over the full ORBIS graph
//  (window.ORBIS_GRAPH_NODES / window.ORBIS_GRAPH_EDGES from the
//  LAZY-LOADED js/orbis-graph.js) so we can answer "route from any
//  place to any place" without an ORBIS API.
//
//  HONEST-SCOPE NOTE: the gorbit weights are a single frozen
//  parameterization (summer, civilian, fastest). There is no month
//  or transport-mode dimension in this data. We optimize on `days`
//  (time) and report km + expense as sourced totals along that path.
//  Do NOT present this as a seasonal/mode simulator.
//
//  Public API (all on window.ORBIS_ROUTE):
//    ready()                    → true once the graph globals exist
//    snapToNode(lat, lng)       → nearest node {node, distKm} or null
//    route(fromId, toId)        → { path, nodes, totalDays, totalKm,
//                                   totalExpense, legs } or null
//    MODE_LABELS                → index-aligned with the build's MODE_ORDER
// ═══════════════════════════════════════════════════════════

(function () {
  'use strict';

  // Index-aligned with MODE_ORDER in scripts/build-orbis.mjs. If that order
  // changes, this must change with it.
  const MODE_LABELS = ['road', 'sea', 'river', 'ferry', 'mixed'];

  function ready() {
    return typeof window.ORBIS_GRAPH_NODES !== 'undefined' &&
           typeof window.ORBIS_GRAPH_EDGES !== 'undefined';
  }

  // ── adjacency (built once, memoized) ──────────────────────
  let _adj = null;       // Map<nodeId, [{to, days, km, expense, mode}]>
  let _nodeById = null;  // Map<nodeId, node>

  function buildAdj() {
    if (_adj) return _adj;
    _adj = new Map();
    _nodeById = new Map();
    for (const n of window.ORBIS_GRAPH_NODES) _nodeById.set(n.id, n);
    const add = (a, b, km, days, exp, mode) => {
      let list = _adj.get(a);
      if (!list) { list = []; _adj.set(a, list); }
      list.push({ to: b, days, km, expense: exp, mode });
    };
    for (const e of window.ORBIS_GRAPH_EDGES) {
      const [s, t, km, days, exp, mode] = e;
      add(s, t, km, days, exp, mode);   // undirected — both directions
      add(t, s, km, days, exp, mode);
    }
    return _adj;
  }

  function nodeById(id) {
    buildAdj();
    return _nodeById.get(id) || null;
  }

  // ── nearest-node snap (haversine) ─────────────────────────
  function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371, toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  function snapToNode(lat, lng) {
    if (!ready()) return null;
    let best = null, bestDist = Infinity;
    for (const n of window.ORBIS_GRAPH_NODES) {
      const d = haversineKm(lat, lng, n.lat, n.lng);
      if (d < bestDist) { bestDist = d; best = n; }
    }
    return best ? { node: best, distKm: bestDist } : null;
  }

  // ── binary min-heap (ported from build-orbis.mjs) ─────────
  class MinHeap {
    constructor() { this.a = []; }
    push(item) {
      this.a.push(item);
      let i = this.a.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (this.a[p][0] <= this.a[i][0]) break;
        [this.a[p], this.a[i]] = [this.a[i], this.a[p]];
        i = p;
      }
    }
    pop() {
      if (!this.a.length) return undefined;
      const top = this.a[0];
      const last = this.a.pop();
      if (this.a.length) {
        this.a[0] = last;
        let i = 0; const n = this.a.length;
        for (;;) {
          const l = i * 2 + 1, r = i * 2 + 2;
          let s = i;
          if (l < n && this.a[l][0] < this.a[s][0]) s = l;
          if (r < n && this.a[r][0] < this.a[s][0]) s = r;
          if (s === i) break;
          [this.a[s], this.a[i]] = [this.a[i], this.a[s]];
          i = s;
        }
      }
      return top;
    }
    get size() { return this.a.length; }
  }

  // ── Dijkstra on `days` with prev-pointer reconstruction ───
  function route(fromId, toId) {
    if (!ready()) return null;
    if (fromId === toId) {
      const n = nodeById(fromId);
      if (!n) return null;
      return { path: [fromId], nodes: [n], totalDays: 0, totalKm: 0, totalExpense: 0, legs: [] };
    }
    const adj = buildAdj();
    const dist = new Map();      // nodeId → cumulative days
    const prev = new Map();      // nodeId → { from, edge }
    const done = new Set();
    const heap = new MinHeap();
    heap.push([0, fromId]);
    dist.set(fromId, 0);

    while (heap.size) {
      const [d, u] = heap.pop();
      if (done.has(u)) continue;
      done.add(u);
      if (u === toId) break;
      const edges = adj.get(u) || [];
      for (const e of edges) {
        if (done.has(e.to)) continue;
        const nd = d + e.days;
        if (nd < (dist.has(e.to) ? dist.get(e.to) : Infinity)) {
          dist.set(e.to, nd);
          prev.set(e.to, { from: u, edge: e });
          heap.push([nd, e.to]);
        }
      }
    }

    if (!done.has(toId) && !prev.has(toId)) return null;  // unreachable

    // Walk prev-pointers back from destination to origin.
    const path = [];
    const legs = [];
    let totalKm = 0, totalExpense = 0;
    let cur = toId;
    while (cur !== fromId) {
      const p = prev.get(cur);
      if (!p) return null;  // broken chain (shouldn't happen if reachable)
      path.push(cur);
      totalKm += p.edge.km;
      totalExpense += p.edge.expense;
      legs.push(p.edge.mode);
      cur = p.from;
    }
    path.push(fromId);
    path.reverse();
    legs.reverse();

    return {
      path,
      nodes: path.map(id => nodeById(id)),
      totalDays: dist.get(toId),
      totalKm,
      totalExpense,
      legs,
    };
  }

  window.ORBIS_ROUTE = { ready, snapToNode, route, nodeById, MODE_LABELS };
})();
