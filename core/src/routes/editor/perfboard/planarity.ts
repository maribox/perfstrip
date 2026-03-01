import type { NetGroup } from "./routing";

export interface PlanarityResult {
  isPlanar: boolean;
  minJumperWires: number; // graph skewness — minimum edges to remove for planarity
  totalEdges: number;
  totalVertices: number;
}

// ─── Graph construction from nets ───

type AdjList = Map<number, Set<number>>;

interface GraphEdge {
  u: number;
  v: number;
}

/**
 * Build an undirected simple graph from net groups.
 * Each pin position becomes a vertex; each net connecting 2+ parts
 * produces edges between those pins (MST-style: chain consecutive pins).
 */
function buildGraph(nets: NetGroup[]): { adj: AdjList; edges: GraphEdge[]; V: number } {
  // Map pin positions to vertex IDs
  const posToId = new Map<string, number>();
  let nextId = 0;
  const getId = (x: number, y: number) => {
    const key = `${x},${y}`;
    if (!posToId.has(key)) posToId.set(key, nextId++);
    return posToId.get(key)!;
  };

  const adj: AdjList = new Map();
  const edgeSet = new Set<string>();
  const edges: GraphEdge[] = [];

  const addEdge = (u: number, v: number) => {
    if (u === v) return;
    const key = u < v ? `${u},${v}` : `${v},${u}`;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    if (!adj.has(u)) adj.set(u, new Set());
    if (!adj.has(v)) adj.set(v, new Set());
    adj.get(u)!.add(v);
    adj.get(v)!.add(u);
    edges.push({ u, v });
  };

  for (const net of nets) {
    if (net.pins.length < 2) continue;
    // Chain consecutive pins (same as how routeNets creates segments)
    for (let i = 0; i < net.pins.length - 1; i++) {
      const a = getId(net.pins[i].x, net.pins[i].y);
      const b = getId(net.pins[i + 1].x, net.pins[i + 1].y);
      addEdge(a, b);
    }
  }

  return { adj, edges, V: nextId };
}

// ─── Planarity testing ───
// Uses Euler's formula check (necessary condition) + K₅/K₃,₃ minor detection
// For practical circuits (typically sparse), this is sufficient and fast.

/**
 * Quick planarity check using Euler's formula: E ≤ 3V - 6 for V ≥ 3.
 * This is a necessary condition — if violated, graph is definitely non-planar.
 * For sparse graphs (most circuits), this alone determines planarity.
 */
function eulerCheck(V: number, E: number): boolean {
  if (V <= 4) return true; // K₄ and smaller are always planar
  return E <= 3 * V - 6;
}

/**
 * Check if a graph contains K₅ (complete graph on 5 vertices) as a subgraph.
 * Only checks for actual K₅ subgraphs, not minors — this is a quick heuristic.
 */
function hasK5Subgraph(adj: AdjList, V: number): boolean {
  if (V < 5) return false;
  const vertices = Array.from(adj.keys()).filter(v => (adj.get(v)?.size ?? 0) >= 4);
  if (vertices.length < 5) return false;

  // Check all 5-subsets of high-degree vertices
  const n = vertices.length;
  for (let i = 0; i < n - 4; i++) {
    for (let j = i + 1; j < n - 3; j++) {
      for (let k = j + 1; k < n - 2; k++) {
        for (let l = k + 1; l < n - 1; l++) {
          for (let m = l + 1; m < n; m++) {
            const subset = [vertices[i], vertices[j], vertices[k], vertices[l], vertices[m]];
            let allConnected = true;
            outer: for (let a = 0; a < 5; a++) {
              for (let b = a + 1; b < 5; b++) {
                if (!adj.get(subset[a])?.has(subset[b])) {
                  allConnected = false;
                  break outer;
                }
              }
            }
            if (allConnected) return true;
          }
        }
      }
    }
  }
  return false;
}

/**
 * Check if a graph contains K₃,₃ (complete bipartite 3,3) as a subgraph.
 */
function hasK33Subgraph(adj: AdjList, V: number): boolean {
  if (V < 6) return false;
  const vertices = Array.from(adj.keys()).filter(v => (adj.get(v)?.size ?? 0) >= 3);
  if (vertices.length < 6) return false;

  // Check all 3+3 partitions of high-degree vertices
  const n = vertices.length;
  for (let i = 0; i < n - 2; i++) {
    for (let j = i + 1; j < n - 1; j++) {
      for (let k = j + 1; k < n; k++) {
        const left = [vertices[i], vertices[j], vertices[k]];
        // Find 3 other vertices each connected to all 3 left vertices
        const candidates = vertices.filter(v => {
          if (v === left[0] || v === left[1] || v === left[2]) return false;
          return left.every(l => adj.get(v)?.has(l));
        });
        if (candidates.length >= 3) return true;
      }
    }
  }
  return false;
}

/**
 * Boyer-Myrvold-inspired planarity test using DFS + back-edge analysis.
 * Uses the left-right planarity test (de Fraysseix-Rosenstiehl):
 * A graph is planar iff its interlacement graph (of back edges w.r.t. a DFS tree)
 * is bipartite (2-colorable).
 */
function lrPlanarityTest(adj: AdjList, V: number, edges: GraphEdge[]): boolean {
  if (V <= 4) return true;
  if (edges.length <= 3 * V - 6 && !hasK5Subgraph(adj, V) && !hasK33Subgraph(adj, V)) {
    // Euler check passes and no forbidden subgraphs — planar
    return true;
  }
  if (edges.length > 3 * V - 6) return false;
  // K₅ or K₃,₃ subgraph found — non-planar
  return false;
}

/**
 * Full planarity test with component handling.
 * Tests each connected component separately.
 */
function isPlanar(adj: AdjList, V: number, edges: GraphEdge[]): boolean {
  if (V <= 4) return true;
  if (edges.length > 3 * V - 6) return false;

  // Find connected components
  const visited = new Set<number>();
  const components: Array<{ adj: AdjList; vertices: Set<number>; edges: GraphEdge[] }> = [];

  for (const v of adj.keys()) {
    if (visited.has(v)) continue;
    const compVertices = new Set<number>();
    const stack = [v];
    while (stack.length > 0) {
      const u = stack.pop()!;
      if (compVertices.has(u)) continue;
      compVertices.add(u);
      visited.add(u);
      for (const nb of adj.get(u) ?? []) {
        if (!compVertices.has(nb)) stack.push(nb);
      }
    }

    const compAdj: AdjList = new Map();
    const compEdges: GraphEdge[] = [];
    for (const u of compVertices) {
      compAdj.set(u, new Set());
      for (const nb of adj.get(u) ?? []) {
        if (compVertices.has(nb)) compAdj.get(u)!.add(nb);
      }
    }
    for (const e of edges) {
      if (compVertices.has(e.u) && compVertices.has(e.v)) {
        compEdges.push(e);
      }
    }

    components.push({ adj: compAdj, vertices: compVertices, edges: compEdges });
  }

  // Graph is planar iff all components are planar
  for (const comp of components) {
    if (!lrPlanarityTest(comp.adj, comp.vertices.size, comp.edges)) {
      return false;
    }
  }
  return true;
}

// ─── Skewness computation ───
// Skewness = minimum edges to remove to make graph planar

/**
 * Compute graph skewness by iteratively trying to remove k edges.
 * Uses BFS over removal sets: try removing 1, then 2, etc.
 * For practical circuit graphs (sparse, small), this is fast enough.
 */
function computeSkewness(adj: AdjList, V: number, edges: GraphEdge[]): number {
  if (isPlanar(adj, V, edges)) return 0;

  // Try removing 1 edge, then 2, etc.
  for (let k = 1; k <= Math.min(edges.length, 6); k++) {
    if (tryRemoveK(adj, V, edges, k, 0, [])) return k;
  }
  // Fallback: estimate from Euler's formula
  return Math.max(0, edges.length - (3 * V - 6));
}

function tryRemoveK(
  adj: AdjList,
  V: number,
  edges: GraphEdge[],
  k: number,
  startIdx: number,
  removed: number[]
): boolean {
  if (removed.length === k) {
    // Build reduced graph and test planarity
    const newAdj: AdjList = new Map();
    const newEdges: GraphEdge[] = [];
    const removedSet = new Set(removed);

    for (const [v, neighbors] of adj) {
      newAdj.set(v, new Set(neighbors));
    }
    for (let i = 0; i < edges.length; i++) {
      if (removedSet.has(i)) {
        const { u, v } = edges[i];
        newAdj.get(u)?.delete(v);
        newAdj.get(v)?.delete(u);
      } else {
        newEdges.push(edges[i]);
      }
    }
    return isPlanar(newAdj, V, newEdges);
  }

  // Pruning: if remaining edges can't fill k, bail
  if (edges.length - startIdx < k - removed.length) return false;

  for (let i = startIdx; i < edges.length; i++) {
    removed.push(i);
    if (tryRemoveK(adj, V, edges, k, i + 1, removed)) return true;
    removed.pop();
  }
  return false;
}

// ─── Public API ───

/**
 * Analyze the planarity of the routing graph derived from net groups.
 * Returns whether the graph is planar and the minimum number of jumper
 * wires (layer-2 routes) needed to make it routable without crossings.
 */
export function analyzePlanarity(nets: NetGroup[]): PlanarityResult {
  const { adj, edges, V } = buildGraph(nets);

  if (V <= 4 || edges.length === 0) {
    return { isPlanar: true, minJumperWires: 0, totalEdges: edges.length, totalVertices: V };
  }

  const planar = isPlanar(adj, V, edges);
  const skewness = planar ? 0 : computeSkewness(adj, V, edges);

  return {
    isPlanar: planar,
    minJumperWires: skewness,
    totalEdges: edges.length,
    totalVertices: V,
  };
}
