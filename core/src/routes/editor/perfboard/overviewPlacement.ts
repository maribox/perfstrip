import type { Part, PinPosition } from "$lib/types";
import { routeNets, extractNets } from "./routing";
import type { NetGroup, RoutingResult } from "./routing";

export type PartPlacement = {
  partKey: string;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  pins: PinPosition[];
};

export type Rotation = 0 | 1 | 2 | 3; // 0°, 90°, 180°, 270° clockwise

type FootprintInfo = { pins: PinPosition[]; w: number; h: number };
type Position = { x: number; y: number };
type NetPin = { partKey: string; localX: number; localY: number };
type PlacementNet = { pins: NetPin[] };

// Rotation helpers
function getRotatedDims(info: FootprintInfo, rot: Rotation): { w: number; h: number } {
  return rot === 1 || rot === 3 ? { w: info.h, h: info.w } : { w: info.w, h: info.h };
}

function rotateLocalPin(x: number, y: number, w: number, h: number, rot: Rotation): { x: number; y: number } {
  switch (rot) {
    case 0: return { x, y };
    case 1: return { x: h - 1 - y, y: x };
    case 2: return { x: w - 1 - x, y: h - 1 - y };
    case 3: return { x: y, y: w - 1 - x };
  }
}

export interface RoutingCosts {
  stepCost: number;
  bendCost: number;
  pinCost: number;
  routeCost: number;
}

// All approaches are integrated place-and-route: every candidate evaluation
// runs the actual A* router so placement quality == routed quality. No HPWL
// proxies or separate placement-then-route pipelines.
export type PlaceRouteApproach = "greedy-route" | "sa"
  | "ga" | "tabu" | "hill-climbing"
  | "ils" | "lahc" | "grasp" | "memetic" | "lns"
  | "vns" | "rrt" | "scatter" | "bls";

// ─── Unified placerouter plugin interface ───
// Every algorithm plugs into this: same input context, same output shape.
// No algorithm does placement-only or routing-only — all are integrated.

export type PlaceRouterContext = {
  unplacedKeys: string[];
  allKeys: string[];
  footprintInfoMap: Map<string, FootprintInfo>;
  fixedPositions: Map<string, Position>;
  initialRotations: Map<string, Rotation>;
  nets: PlacementNet[];
  parts: Record<string, Part>;
  parsedKiCadDoc: any;
  routingCosts: RoutingCosts;
  boardW: number;
  boardH: number;
  maxJumpers?: number;
  deadline?: number;
  boardType?: "perfboard" | "stripboard";
  config?: AdvancedConfig;
  // greedy-route extras (ignored by other algorithms)
  flexVariantsMap?: Map<string, FlexVariant[]>;
};

export type PlaceRouterResult = {
  positions: Map<string, Position>;
  rotations: Map<string, Rotation>;
  cost: number;
};

export type PlaceRouterFn = (ctx: PlaceRouterContext) => PlaceRouterResult;

export type AcoVariant = "mmas" | "as" | "acs" | "rank-based";

export type AlgorithmFamily =
  | "aco-mmas" | "aco-as" | "aco-acs" | "aco-rank"
  | "sa" | "greedy" | "ga" | "tabu" | "hill-climbing"
  | "ils" | "lahc" | "grasp" | "memetic" | "lns"
  | "vns" | "rrt" | "scatter" | "bls";

export interface AdvancedConfig {
  // ACO variant selection
  acoVariant?: AcoVariant;         // default: "mmas"
  // ACO parameters
  numAnts?: number;                // default: 10
  numIterations?: number;          // default: 20
  alpha?: number;                  // default: 1.0  (pheromone importance)
  beta?: number;                   // default: 2.0  (heuristic importance)
  rho?: number;                    // default: 0.3  (evaporation rate 0-1)
  Q?: number;                      // default: 100  (pheromone deposit constant)
  elitistWeight?: number;          // default: 1    (extra deposit on global best, 0=off)
  candidateListSize?: number;      // default: 20
  minPheromone?: number;           // default: 0.1  (MMAS lower bound)
  maxPheromone?: number;           // default: 10   (MMAS upper bound)
  pheromoneInit?: number;          // default: 1.0
  localSearchEnabled?: boolean;    // default: true
  localSearchMoves?: number;       // default: 30
  partOrderStrategy?: "largest-first" | "most-connected" | "random"; // default: "largest-first"
  compactnessWeight?: number;      // default: 3
  areaMultiplier?: number;         // default: 2.5 (perfboard)
  // ACS-specific
  q0?: number;                     // default: 0.9  (exploitation threshold for pseudo-random rule)
  localDecay?: number;             // default: 0.1  (local pheromone decay after placing each part)
  // Rank-Based AS-specific
  rankW?: number;                  // default: 6    (number of top ants that deposit pheromone)
  // Connectivity & clearance heuristics
  connStrength?: number;           // default: adaptive based on net count (explicit pull toward connected pins)
  targetedSamplingRatio?: number;  // default: 0.5  (fraction of candidates near connected pins)
  clearanceWeight?: number;        // default: adaptive (perimeter clearance scoring)
  // SA-specific
  saTemperature?: number;          // default: 50
  saCoolingRate?: number;          // default: 0.95
  saInnerIter?: number;            // default: 30
  // Genetic Algorithm
  gaPopSize?: number;              // default: 20
  gaGenerations?: number;          // default: 30
  gaCrossoverRate?: number;        // default: 0.7
  gaMutationRate?: number;         // default: 0.3
  // Tabu Search
  tabuTenure?: number;             // default: 10
  tabuMaxIter?: number;            // default: 200
  // Hill Climbing
  hcRestarts?: number;             // default: 10
  hcMaxIter?: number;              // default: 100
  // ILS (Iterated Local Search)
  ilsPerturbStrength?: number;     // default: 3 (parts to displace per perturbation)
  ilsMaxIter?: number;             // default: 100
  ilsAcceptWorse?: number;         // default: 0.05 (probability of accepting worse after LS)
  // LAHC (Late Acceptance Hill Climbing)
  lahcHistoryLength?: number;      // default: 50 (L parameter)
  lahcMaxIter?: number;            // default: 200
  // GRASP
  graspRestarts?: number;          // default: 8
  graspLsIter?: number;            // default: 50 (local search iterations per restart)
  // Memetic Algorithm (GA + local search)
  memeticPopSize?: number;         // default: 12
  memeticGenerations?: number;     // default: 20
  memeticCrossoverRate?: number;   // default: 0.7
  memeticMutationRate?: number;    // default: 0.3
  memeticLsIter?: number;          // default: 15 (LS iterations per offspring)
  // LNS (Large Neighborhood Search) — benchmark winner
  lnsDestroyRatio?: number;        // default: 0.20 (fraction of parts to remove — low wins)
  lnsMaxIter?: number;             // default: 150
  lnsAdaptive?: boolean;           // default: true (increase destroy when stuck)
  // VNS (Variable Neighborhood Search)
  vnsKmax?: number;                // default: 5 (max neighborhood size)
  vnsMaxIter?: number;             // default: 100
  // RRT (Record-to-Record Travel)
  rrtDeviation?: number;           // default: 0.05 (fraction of current cost as tolerance)
  rrtMaxIter?: number;             // default: 200
  // Scatter Search
  scatterRefSize?: number;         // default: 10 (reference set size)
  scatterMaxIter?: number;         // default: 30
  // BLS (Breakout Local Search)
  blsPenaltyWeight?: number;       // default: 50 (weight for revisitation penalty)
  blsMaxIter?: number;             // default: 200
  // Beauty filter: group same-type parts on their longer side
  beautyFilter?: boolean;          // default: false
}

interface PlacementInput {
  parts: Record<string, Part>;
  parsedKiCadDoc: any;
  manualPositions: Record<string, { x: number; y: number }>;
  getFootprintInfo: (part: Part) => FootprintInfo | null;
  rotations?: Record<string, Rotation>;
  routingCosts?: RoutingCosts;
  approach?: PlaceRouteApproach; // all approaches do integrated place+route (no HPWL-only)
  minCols?: number;
  minRows?: number;
  maxCols?: number;
  maxRows?: number;
  maxSum?: number;
  maxJumpers?: number;
  timeoutMs?: number;
  flexResistors?: boolean;
  boardType?: "perfboard" | "stripboard";
  beautyFilter?: boolean;
  advancedConfig?: AdvancedConfig;
}

export interface PlacementResult {
  placements: PartPlacement[];
  boardCols: number;
  boardRows: number;
  rotations: Record<string, Rotation>;
  routing?: RoutingResult;
}

// ─── Flexible resistor shape variants ───
// For 2-pin variable footprints (resistors) with span >= 4, generate L-shape
// variants. Each variant places pins at (0,0) and (dx,dy) where dx+dy = span-1.
// Only pin cells are blocked — the wire body goes over the front of the board.

type FlexVariant = { pins: PinPosition[]; w: number; h: number; extraLength: number };

function generateFlexVariants(info: FootprintInfo, part: Part): FlexVariant[] {
  if (!part.footprint || part.footprint.layout.type !== "variable") return [];
  if (info.pins.length !== 2) return [];
  const span = part.footprint.layout.minLength ?? 4;
  if (span < 4) return [];

  const dist = span - 1; // Manhattan distance between pins
  const variants: FlexVariant[] = [];

  // Straight variants (original) — horizontal and vertical
  variants.push({
    pins: [
      { x: 0, y: 0, pinNumber: 1, name: "1" },
      { x: dist, y: 0, pinNumber: 2, name: "2" }
    ],
    w: dist + 1, h: 1, extraLength: 0
  });
  variants.push({
    pins: [
      { x: 0, y: 0, pinNumber: 1, name: "1" },
      { x: 0, y: dist, pinNumber: 2, name: "2" }
    ],
    w: 1, h: dist + 1, extraLength: 0
  });

  // L-shape variants: pin2 at (dx, dy) where dx + dy = dist, dx > 0, dy > 0
  for (let dx = 1; dx < dist; dx++) {
    const dy = dist - dx;
    // Extra wire length = how much longer than the straight line between pin positions
    // In an L-shape the wire must travel dx + dy which equals dist, same as straight.
    // But extra board area is used, so we penalize based on the bounding box increase.
    const extraLength = 0; // Manhattan distance is the same; cost comes from routing
    variants.push({
      pins: [
        { x: 0, y: 0, pinNumber: 1, name: "1" },
        { x: dx, y: dy, pinNumber: 2, name: "2" }
      ],
      w: dx + 1, h: dy + 1, extraLength
    });
    // Mirror: pin2 at (dx, -dy) → normalized to (0, 0) and (dx, 0) with pin1 at (0, dy)
    variants.push({
      pins: [
        { x: 0, y: dy, pinNumber: 1, name: "1" },
        { x: dx, y: 0, pinNumber: 2, name: "2" }
      ],
      w: dx + 1, h: dy + 1, extraLength
    });
  }

  return variants;
}

// ─── Net extraction ───

function buildPlacementNets(
  parts: Record<string, Part>,
  parsedKiCadDoc: any,
  footprintInfoMap: Map<string, FootprintInfo>,
  allPartKeys: string[]
): PlacementNet[] {
  const netMap = new Map<number, NetPin[]>();

  for (const partKey of allPartKeys) {
    const part = parts[partKey];
    if (!part?.pins) continue;
    const info = footprintInfoMap.get(partKey);
    if (!info) continue;

    for (const partPin of part.pins) {
      if (!partPin.netCode) continue;
      if (parsedKiCadDoc?.nets) {
        const net = parsedKiCadDoc.nets.find((n: any) => n.code === partPin.netCode);
        if (net?.name && /^unconnected/i.test(net.name)) continue;
      }
      const fpPin = info.pins.find((p) => p.pinNumber == partPin.pinNumber);
      if (!fpPin) continue;

      if (!netMap.has(partPin.netCode)) netMap.set(partPin.netCode, []);
      netMap.get(partPin.netCode)!.push({ partKey, localX: fpPin.x, localY: fpPin.y });
    }
  }

  return Array.from(netMap.values())
    .filter((pins) => new Set(pins.map((p) => p.partKey)).size >= 2)
    .map((pins) => ({ pins }));
}

// ─── Overlap detection ───

function rectsOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
  gap: number
): boolean {
  return ax < bx + bw + gap && ax + aw + gap > bx && ay < by + bh + gap && ay + ah + gap > by;
}

function hasOverlap(
  x: number, y: number, w: number, h: number,
  placed: Map<string, Position>,
  footprintInfoMap: Map<string, FootprintInfo>,
  rotations: Map<string, Rotation>,
  excludeKey?: string,
  gap: number = 0
): boolean {
  for (const [otherKey, otherPos] of placed) {
    if (otherKey === excludeKey) continue;
    const oi = footprintInfoMap.get(otherKey);
    if (!oi) continue;
    const { w: ow, h: oh } = getRotatedDims(oi, rotations.get(otherKey) ?? 0);
    if (rectsOverlap(x, y, w, h, otherPos.x, otherPos.y, ow, oh, gap)) return true;
  }
  return false;
}

// ─── Connectivity scoring ───

// Build adjacency: which parts share nets?
function buildPartConnections(
  nets: PlacementNet[]
): Map<string, Map<string, number>> {
  const connections = new Map<string, Map<string, number>>();
  for (const net of nets) {
    const keys = [...new Set(net.pins.map(p => p.partKey))];
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        if (!connections.has(keys[i])) connections.set(keys[i], new Map());
        if (!connections.has(keys[j])) connections.set(keys[j], new Map());
        connections.get(keys[i])!.set(keys[j], (connections.get(keys[i])!.get(keys[j]) ?? 0) + 1);
        connections.get(keys[j])!.set(keys[i], (connections.get(keys[j])!.get(keys[i]) ?? 0) + 1);
      }
    }
  }
  return connections;
}

// HPWL wire length for a specific part position, considering all nets it participates in
function wireLength(
  partKey: string,
  partPos: Position,
  nets: PlacementNet[],
  positions: Map<string, Position>,
  footprintInfoMap: Map<string, FootprintInfo>,
  rotations: Map<string, Rotation>
): number {
  let totalCost = 0;
  for (const net of nets) {
    const hasThisPart = net.pins.some(p => p.partKey === partKey);
    if (!hasThisPart) continue;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const pin of net.pins) {
      const pos = pin.partKey === partKey ? partPos : positions.get(pin.partKey);
      if (!pos) continue;
      const info = footprintInfoMap.get(pin.partKey);
      if (!info) continue;
      const rot = rotations.get(pin.partKey) ?? 0;
      const rp = rotateLocalPin(pin.localX, pin.localY, info.w, info.h, rot);
      const wx = pos.x + rp.x;
      const wy = pos.y + rp.y;
      minX = Math.min(minX, wx);
      maxX = Math.max(maxX, wx);
      minY = Math.min(minY, wy);
      maxY = Math.max(maxY, wy);
    }
    if (minX !== Infinity) {
      totalCost += (maxX - minX) + (maxY - minY);
    }
  }
  return totalCost;
}

// ─── Greedy constructive placement ───

function greedyPlace(
  keys: string[],
  footprintInfoMap: Map<string, FootprintInfo>,
  fixedPositions: Map<string, Position>,
  nets: PlacementNet[],
  rotations: Map<string, Rotation>,
  boardW: number,
  boardH: number
): Map<string, Position> {
  if (keys.length === 0) return new Map();

  const positions = new Map<string, Position>(fixedPositions);
  const connections = buildPartConnections(nets);

  // Sort: most connected first, then largest first
  const sorted = [...keys].sort((a, b) => {
    const connA = connections.get(a)?.size ?? 0;
    const connB = connections.get(b)?.size ?? 0;
    if (connB !== connA) return connB - connA;
    const areaA = footprintInfoMap.get(a)!.w * footprintInfoMap.get(a)!.h;
    const areaB = footprintInfoMap.get(b)!.w * footprintInfoMap.get(b)!.h;
    return areaB - areaA;
  });

  // Place the first part at (0, 0)
  const firstKey = sorted[0];
  const firstInfo = footprintInfoMap.get(firstKey)!;
  const firstDims = getRotatedDims(firstInfo, rotations.get(firstKey) ?? 0);
  if (positions.size === 0) {
    positions.set(firstKey, { x: 0, y: 0 });
  } else {
    // Place near the centroid of fixed parts, trying rotations if needed
    const best = findBestPosition(firstKey, firstDims.w, firstDims.h, positions, footprintInfoMap, rotations, nets, boardW, boardH);
    if (best) { positions.set(firstKey, best); }
    else {
      for (const tryRot of [1, 2, 3] as Rotation[]) {
        const r = ((rotations.get(firstKey) ?? 0) + tryRot) % 4 as Rotation;
        rotations.set(firstKey, r);
        const d = getRotatedDims(firstInfo, r);
        const pos = findBestPosition(firstKey, d.w, d.h, positions, footprintInfoMap, rotations, nets, boardW, boardH);
        if (pos) { positions.set(firstKey, pos); break; }
      }
    }
  }

  // Place remaining parts one by one, trying all rotations if needed
  for (let i = 1; i < sorted.length; i++) {
    const key = sorted[i];
    const info = footprintInfoMap.get(key)!;
    const origRot = rotations.get(key) ?? 0;
    const dims = getRotatedDims(info, origRot);
    const best = findBestPosition(key, dims.w, dims.h, positions, footprintInfoMap, rotations, nets, boardW, boardH);
    if (best) { positions.set(key, best); continue; }
    // Try other rotations
    for (const tryRot of [1, 2, 3] as Rotation[]) {
      const r = ((origRot + tryRot) % 4) as Rotation;
      rotations.set(key, r);
      const d = getRotatedDims(info, r);
      const pos = findBestPosition(key, d.w, d.h, positions, footprintInfoMap, rotations, nets, boardW, boardH);
      if (pos) { positions.set(key, pos); break; }
    }
    if (!positions.has(key)) rotations.set(key, origRot);
  }

  // Remove fixed positions from result (they're handled separately)
  for (const key of fixedPositions.keys()) {
    positions.delete(key);
  }

  return positions;
}

function findBestPosition(
  key: string,
  w: number,
  h: number,
  placed: Map<string, Position>,
  footprintInfoMap: Map<string, FootprintInfo>,
  rotations: Map<string, Rotation>,
  nets: PlacementNet[],
  boardW: number,
  boardH: number
): Position | null {
  // Generate candidate positions: adjacent to all placed parts + origin area
  const candidates = new Set<string>();

  // Always try origin area
  for (let x = 0; x <= Math.min(3, boardW - w); x++) {
    for (let y = 0; y <= Math.min(3, boardH - h); y++) {
      candidates.add(`${x},${y}`);
    }
  }

  // Try positions adjacent to each placed part (directly touching)
  for (const [_, pos] of placed) {
    const oi = footprintInfoMap.get(_);
    if (!oi) continue;
    const od = getRotatedDims(oi, rotations.get(_) ?? 0);

    // Right side
    for (let dy = -h + 1; dy < od.h; dy++) {
      candidates.add(`${pos.x + od.w},${pos.y + dy}`);
    }
    // Left side
    for (let dy = -h + 1; dy < od.h; dy++) {
      candidates.add(`${pos.x - w},${pos.y + dy}`);
    }
    // Below
    for (let dx = -w + 1; dx < od.w; dx++) {
      candidates.add(`${pos.x + dx},${pos.y + od.h}`);
    }
    // Above
    for (let dx = -w + 1; dx < od.w; dx++) {
      candidates.add(`${pos.x + dx},${pos.y - h}`);
    }
    // Aligned positions
    candidates.add(`${pos.x},${pos.y + od.h}`);
    candidates.add(`${pos.x},${pos.y - h}`);
    candidates.add(`${pos.x + od.w},${pos.y}`);
    candidates.add(`${pos.x - w},${pos.y}`);
  }

  const scorePosition = (cx: number, cy: number): number => {
    const pos = { x: cx, y: cy };
    const wl = wireLength(key, pos, nets, placed, footprintInfoMap, rotations);
    let minBBX = cx, maxBBX = cx + w, minBBY = cy, maxBBY = cy + h;
    for (const [pk, pp] of placed) {
      if (pk === key) continue;
      const pi = footprintInfoMap.get(pk);
      if (!pi) continue;
      const pd = getRotatedDims(pi, rotations.get(pk) ?? 0);
      minBBX = Math.min(minBBX, pp.x);
      maxBBX = Math.max(maxBBX, pp.x + pd.w);
      minBBY = Math.min(minBBY, pp.y);
      maxBBY = Math.max(maxBBY, pp.y + pd.h);
    }
    const bbArea = (maxBBX - minBBX) * (maxBBY - minBBY);
    return wl * 3 + bbArea * 4;
  };

  let bestPos: Position | null = null;
  let bestScore = Infinity;

  for (const cand of candidates) {
    const [cx, cy] = cand.split(",").map(Number);
    if (cx < 0 || cy < 0) continue;
    if (cx + w > boardW || cy + h > boardH) continue;
    if (hasOverlap(cx, cy, w, h, placed, footprintInfoMap, rotations, key)) continue;

    const score = scorePosition(cx, cy);
    if (score < bestScore) {
      bestScore = score;
      bestPos = { x: cx, y: cy };
    }
  }

  // Fallback: scan the entire board if no adjacent candidate worked
  if (!bestPos) {
    for (let cy = 0; cy <= boardH - h; cy++) {
      for (let cx = 0; cx <= boardW - w; cx++) {
        if (hasOverlap(cx, cy, w, h, placed, footprintInfoMap, rotations, key)) continue;
        const score = scorePosition(cx, cy);
        if (score < bestScore) {
          bestScore = score;
          bestPos = { x: cx, y: cy };
        }
      }
    }
  }

  // Last resort: scan entire board for any valid position
  if (!bestPos) {
    for (let cy = 0; cy <= boardH - h; cy++) {
      for (let cx = 0; cx <= boardW - w; cx++) {
        if (!hasOverlap(cx, cy, w, h, placed, footprintInfoMap, rotations, key)) {
          return { x: cx, y: cy };
        }
      }
    }
    // No valid position exists — return null instead of overlapping
    return null;
  }

  return bestPos;
}

// ─── Route-aware SA refinement ───

function computeCompactnessCost(
  positions: Map<string, Position>,
  footprintInfoMap: Map<string, FootprintInfo>,
  rotations: Map<string, Rotation>
): number {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [key, pos] of positions) {
    const info = footprintInfoMap.get(key);
    if (!info) continue;
    const { w, h } = getRotatedDims(info, rotations.get(key) ?? 0);
    minX = Math.min(minX, pos.x);
    maxX = Math.max(maxX, pos.x + w);
    minY = Math.min(minY, pos.y);
    maxY = Math.max(maxY, pos.y + h);
  }
  if (minX === Infinity) return 0;
  // Light area-based compactness — routing quality takes priority
  return (maxX - minX) * (maxY - minY);
}

// ─── Beauty filter: penalise when same-type parts aren't aligned on their long side ───

type PartTypeGroup = { keys: string[]; isHorizontal: (key: string) => boolean };

function buildPartTypeGroups(
  parts: Record<string, Part>,
  footprintInfoMap: Map<string, FootprintInfo>,
): Map<string, string[]> {
  // Group by component value + footprint dimensions (ignoring rotation)
  const groups = new Map<string, string[]>();
  for (const [key] of footprintInfoMap) {
    const part = parts[key];
    if (!part) continue;
    const info = footprintInfoMap.get(key)!;
    const value = part.comp.value ?? part.name ?? "";
    const groupKey = `${value}|${Math.min(info.w, info.h)}x${Math.max(info.w, info.h)}`;
    let g = groups.get(groupKey);
    if (!g) { g = []; groups.set(groupKey, g); }
    g.push(key);
  }
  // Only keep groups with 2+ parts
  for (const [k, v] of groups) { if (v.length < 2) groups.delete(k); }
  return groups;
}

function computeBeautyCost(
  groups: Map<string, string[]>,
  positions: Map<string, Position>,
  rotations: Map<string, Rotation>,
  footprintInfoMap: Map<string, FootprintInfo>,
): number {
  let penalty = 0;
  for (const [, keys] of groups) {
    // For each pair in the group, check if they're touching on their longer side
    const placed = keys.filter(k => positions.has(k));
    if (placed.length < 2) continue;

    // Get positions + dims for each part in the group
    const parts = placed.map(k => {
      const pos = positions.get(k)!;
      const info = footprintInfoMap.get(k)!;
      const rot = rotations.get(k) ?? 0;
      const { w, h } = getRotatedDims(info, rot);
      return { key: k, x: pos.x, y: pos.y, w, h };
    });

    // Sort by primary axis (longer side horizontal → sort by x, else by y)
    // The "longer side" is the max(w,h) of the original footprint (before rotation)
    const origInfo = footprintInfoMap.get(placed[0])!;
    const longerIsW = origInfo.w >= origInfo.h;

    // For beauty, all same parts should form a row/column touching on the long side
    // Penalty = sum of gaps between consecutive parts when sorted along the short axis
    if (longerIsW) {
      // Long side horizontal — parts should be stacked vertically (same x, consecutive y)
      parts.sort((a, b) => a.y - b.y || a.x - b.x);
      for (let i = 1; i < parts.length; i++) {
        const prev = parts[i - 1];
        const curr = parts[i];
        // They should share the same x and be y-adjacent
        const xMismatch = Math.abs(curr.x - prev.x);
        const yGap = Math.abs(curr.y - (prev.y + prev.h));
        penalty += xMismatch * 50 + yGap * 30;
      }
    } else {
      // Long side vertical — parts should be placed side-by-side (same y, consecutive x)
      parts.sort((a, b) => a.x - b.x || a.y - b.y);
      for (let i = 1; i < parts.length; i++) {
        const prev = parts[i - 1];
        const curr = parts[i];
        const yMismatch = Math.abs(curr.y - prev.y);
        const xGap = Math.abs(curr.x - (prev.x + prev.w));
        penalty += yMismatch * 50 + xGap * 30;
      }
    }
  }
  return penalty;
}

// ─── Ant Colony Optimization (placement + routing) ───

function buildPlacementsFromPositions(
  allKeys: string[],
  positions: Map<string, Position>,
  rotations: Map<string, Rotation>,
  footprintInfoMap: Map<string, FootprintInfo>
): PartPlacement[] {
  const placements: PartPlacement[] = [];
  for (const key of allKeys) {
    const pos = positions.get(key);
    if (!pos) continue;
    const info = footprintInfoMap.get(key);
    if (!info) continue;
    const rot = rotations.get(key) ?? 0;
    const { w, h } = getRotatedDims(info, rot);
    placements.push({
      partKey: key,
      offsetX: pos.x,
      offsetY: pos.y,
      width: w,
      height: h,
      pins: info.pins.map((p) => {
        const rp = rotateLocalPin(p.x, p.y, info.w, info.h, rot);
        return { ...p, x: rp.x + pos.x, y: rp.y + pos.y };
      }),
    });
  }
  return placements;
}

function antColonyPlacementAndRouting(
  initialPos: Map<string, Position>,
  movableKeys: string[],
  allKeys: string[],
  footprintInfoMap: Map<string, FootprintInfo>,
  fixedPositions: Map<string, Position>,
  initialRotations: Map<string, Rotation>,
  nets: PlacementNet[],
  parts: Record<string, Part>,
  parsedKiCadDoc: any,
  routingCosts: RoutingCosts,
  boardW: number,
  boardH: number,
  maxJumpers?: number,
  deadline?: number,
  boardType?: "perfboard" | "stripboard",
  config?: AdvancedConfig,
): { positions: Map<string, Position>; rotations: Map<string, Rotation>; cost: number } {
  if (movableKeys.length <= 1 && movableKeys.length + fixedPositions.size <= 1) {
    return { positions: initialPos, rotations: initialRotations, cost: 0 };
  }

  // ACO defaults tuned via evolutionary benchmark (ACO-ACS cost=1030; LNS is now preferred)
  const variant: AcoVariant = config?.acoVariant ?? "acs";
  const numAnts = config?.numAnts ?? 32;
  const numIterations = config?.numIterations ?? 33;
  const alpha = config?.alpha ?? 1.8;
  const beta = config?.beta ?? 1.7;
  const rho = config?.rho ?? 0.89;
  const Q_val = config?.Q ?? 1160;
  const elitistWeight = config?.elitistWeight ?? 5;
  const candidateListSize = config?.candidateListSize ?? 43;
  const minPheromone = config?.minPheromone ?? 0.22;
  const maxPheromone = config?.maxPheromone ?? 3;
  const pheromoneInit = config?.pheromoneInit ?? 0.1;
  const doLocalSearch = config?.localSearchEnabled ?? true;
  const lsMoves = config?.localSearchMoves ?? 70;
  const partOrderStrategy = config?.partOrderStrategy ?? "random";
  const compactnessWeight = config?.compactnessWeight ?? 14;
  // ACS-specific
  const q0 = config?.q0 ?? 0.74;
  const localDecay = config?.localDecay ?? 0.28;
  // Rank-Based AS
  const rankW = config?.rankW ?? 6;
  // Connectivity & clearance heuristics
  const targetedSamplingRatio = config?.targetedSamplingRatio ?? 0.22;
  const clearanceWeightCfg = config?.clearanceWeight;
  const connStrength = config?.connStrength ?? 3.3;
  const clearanceW = clearanceWeightCfg ?? 0.54;
  const beautyGroups = maybeBuildBeautyGroups(config?.beautyFilter, parts, footprintInfoMap);

  const connections = buildPartConnections(nets);

  const baseOrder = (() => {
    switch (partOrderStrategy) {
      case "most-connected":
        return [...movableKeys].sort((a, b) => {
          const connA = connections.get(a)?.size ?? 0;
          const connB = connections.get(b)?.size ?? 0;
          if (connB !== connA) return connB - connA;
          const areaA = footprintInfoMap.get(a)!.w * footprintInfoMap.get(a)!.h;
          const areaB = footprintInfoMap.get(b)!.w * footprintInfoMap.get(b)!.h;
          return areaB - areaA;
        });
      case "random":
        return [...movableKeys];
      default:
        return [...movableKeys].sort((a, b) => {
          const areaA = footprintInfoMap.get(a)!.w * footprintInfoMap.get(a)!.h;
          const areaB = footprintInfoMap.get(b)!.w * footprintInfoMap.get(b)!.h;
          if (areaB !== areaA) return areaB - areaA;
          const connA = connections.get(a)?.size ?? 0;
          const connB = connections.get(b)?.size ?? 0;
          return connB - connA;
        });
    }
  })();

  const lcg = (s: number) => (s * 1664525 + 1013904223) >>> 0;
  const shuffleWithSeed = (arr: string[], seed: number): string[] => {
    const out = [...arr];
    let s = seed;
    for (let i = out.length - 1; i > 0; i--) {
      s = lcg(s);
      const j = s % (i + 1);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };

  // Evaluate a complete placement with actual A* routing
  const evaluateSolution = (pos: Map<string, Position>, rots: Map<string, Rotation>): number =>
    evaluateFullRouting(pos, rots, allKeys, fixedPositions, footprintInfoMap,
      parts, parsedKiCadDoc, routingCosts, maxJumpers, deadline, boardType, compactnessWeight, beautyGroups);

  // Initialize pheromone trails
  const pheromone = new Map<string, Map<string, number>>();
  for (const key of movableKeys) {
    pheromone.set(key, new Map());
  }

  // Seed from initial greedy solution
  const initCost = evaluateSolution(initialPos, initialRotations);
  let globalBestPos = new Map(initialPos);
  let globalBestRot = new Map(initialRotations);
  let globalBestCost = initCost;

  if (initCost < Infinity && initCost > 0) {
    const deposit = Q_val / initCost;
    for (const [partKey, pos] of initialPos) {
      const rot = initialRotations.get(partKey) ?? 0;
      const pKey = `${pos.x},${pos.y},${rot}`;
      const trails = pheromone.get(partKey);
      if (trails) trails.set(pKey, pheromoneInit + deposit);
    }
  }

  // Construct one ant's solution via pheromone-guided roulette wheel
  const constructAnt = (antIdx: number, iter: number): {
    positions: Map<string, Position>;
    rotations: Map<string, Rotation>;
  } => {
    const placed = new Map<string, Position>(fixedPositions);
    const rots = new Map<string, Rotation>(initialRotations);
    const keys = partOrderStrategy === "random"
      ? shuffleWithSeed(baseOrder, antIdx * 7919 + iter * 3571)
      : baseOrder;

    for (const partKey of keys) {
      const info = footprintInfoMap.get(partKey)!;
      let candidates: Array<{ x: number; y: number; rot: Rotation }>;
      if (placed.size === fixedPositions.size) {
        candidates = ([0, 1, 2, 3] as Rotation[]).map(rot => ({ x: 0, y: 0, rot }));
      } else {
        candidates = generateMCTSCandidates(
          partKey, footprintInfoMap, placed, rots,
          nets, boardW, boardH, candidateListSize,
          targetedSamplingRatio, connections
        );
      }

      if (candidates.length === 0) {
        // Try all 4 rotations before giving up
        let found = false;
        for (const tryRot of [0, 1, 2, 3] as Rotation[]) {
          rots.set(partKey, tryRot);
          const dims = getRotatedDims(info, tryRot);
          const pos = findBestPosition(partKey, dims.w, dims.h, placed, footprintInfoMap, rots, nets, boardW, boardH);
          if (pos) { placed.set(partKey, pos); found = true; break; }
        }
        if (!found) rots.set(partKey, initialRotations.get(partKey) ?? 0);
        continue;
      }

      // Build list of target pins this part connects to (already-placed only)
      const targetPins: Array<{ x: number; y: number }> = [];
      for (const net of nets) {
        const thisPartPins = net.pins.filter(p => p.partKey === partKey);
        const otherPins = net.pins.filter(p => p.partKey !== partKey && placed.has(p.partKey));
        if (thisPartPins.length > 0 && otherPins.length > 0) {
          for (const op of otherPins) {
            const oPos = placed.get(op.partKey);
            const oInfo = footprintInfoMap.get(op.partKey);
            if (!oPos || !oInfo) continue;
            const oRot = rots.get(op.partKey) ?? 0;
            const rp = rotateLocalPin(op.localX, op.localY, oInfo.w, oInfo.h, oRot);
            targetPins.push({ x: oPos.x + rp.x, y: oPos.y + rp.y });
          }
        }
      }

      const partTrails = pheromone.get(partKey);
      const scores: number[] = [];
      for (const cand of candidates) {
        const pKey = `${cand.x},${cand.y},${cand.rot}`;
        const tau = partTrails?.get(pKey) ?? pheromoneInit;
        const tempRot = new Map(rots);
        tempRot.set(partKey, cand.rot);
        const wl = wireLength(partKey, { x: cand.x, y: cand.y }, nets, placed, footprintInfoMap, tempRot);
        const eta = 1 / (wl + 1);

        // Connectivity heuristic: explicit pull toward connected placed pins
        let connScore = 1.0;
        if (targetPins.length > 0 && connStrength > 0) {
          let totalPull = 0;
          for (const tp of targetPins) {
            // Use the centroid of the candidate for distance
            const dims = getRotatedDims(info, cand.rot);
            const cx = cand.x + dims.w / 2;
            const cy = cand.y + dims.h / 2;
            const dist = Math.abs(cx - tp.x) + Math.abs(cy - tp.y);
            totalPull += 10 / Math.max(dist, 1);
          }
          connScore = Math.pow(1 + totalPull / targetPins.length, connStrength);
        }

        // Clearance scoring: fraction of perimeter cells that are free
        let clearScore = 1.0;
        if (clearanceW > 0) {
          const dims = getRotatedDims(info, cand.rot);
          let perimTotal = 0;
          let perimFree = 0;
          for (let dx = -1; dx <= dims.w; dx++) {
            for (let dy = -1; dy <= dims.h; dy++) {
              if (dx >= 0 && dx < dims.w && dy >= 0 && dy < dims.h) continue; // inside body
              const gx = cand.x + dx, gy = cand.y + dy;
              if (gx < 0 || gy < 0 || gx >= boardW || gy >= boardH) continue;
              perimTotal++;
              // Check if this cell is occupied by another part
              let occupied = false;
              for (const [otherKey, otherPos] of placed) {
                if (otherKey === partKey) continue;
                const oi = footprintInfoMap.get(otherKey);
                if (!oi) continue;
                const od = getRotatedDims(oi, rots.get(otherKey) ?? 0);
                if (gx >= otherPos.x && gx < otherPos.x + od.w &&
                    gy >= otherPos.y && gy < otherPos.y + od.h) {
                  occupied = true;
                  break;
                }
              }
              if (!occupied) perimFree++;
            }
          }
          const freeRatio = perimTotal > 0 ? perimFree / perimTotal : 1;
          clearScore = Math.pow(Math.max(freeRatio, 0.01), clearanceW);
        }

        scores.push(Math.pow(tau, alpha) * Math.pow(eta, beta) * connScore * clearScore);
      }

      let selected = candidates[0];
      if (variant === "acs" && Math.random() < q0) {
        // ACS pseudo-random proportional rule: exploit best candidate
        let bestIdx = 0;
        for (let i = 1; i < scores.length; i++) {
          if (scores[i] > scores[bestIdx]) bestIdx = i;
        }
        selected = candidates[bestIdx];
      } else {
        // Standard roulette wheel selection (AS, MMAS, Rank-Based, ACS explore)
        const total = scores.reduce((a, b) => a + b, 0);
        if (total > 0) {
          let r = Math.random() * total;
          for (let i = 0; i < candidates.length; i++) {
            r -= scores[i];
            if (r <= 0) { selected = candidates[i]; break; }
          }
        }
      }
      placed.set(partKey, { x: selected.x, y: selected.y });
      rots.set(partKey, selected.rot);

      // ACS local pheromone update: decay chosen position to encourage diversity
      if (variant === "acs" && partTrails) {
        const pKey = `${selected.x},${selected.y},${selected.rot}`;
        const old = partTrails.get(pKey) ?? pheromoneInit;
        partTrails.set(pKey, (1 - localDecay) * old + localDecay * pheromoneInit);
      }
    }

    const movablePos = new Map<string, Position>();
    for (const k of movableKeys) {
      const p = placed.get(k);
      if (p) movablePos.set(k, p);
    }
    return { positions: movablePos, rotations: rots };
  };

  // Local search: random swap/displace/rotate moves, hill-climbing only
  const localSearch = (
    pos: Map<string, Position>,
    rots: Map<string, Rotation>,
    cost: number,
  ): { positions: Map<string, Position>; rotations: Map<string, Rotation>; cost: number } => {
    let bestPos = pos;
    let bestRot = rots;
    let bestCost = cost;

    for (let m = 0; m < lsMoves; m++) {
      if (deadline && Date.now() > deadline) break;
      const allPos = new Map([...fixedPositions, ...bestPos]);
      const newPos = new Map(allPos);
      const newRot = new Map(bestRot);

      const r = Math.random();
      if (r < 0.3 && movableKeys.length >= 2) {
        const ai = Math.floor(Math.random() * movableKeys.length);
        let bi = Math.floor(Math.random() * (movableKeys.length - 1));
        if (bi >= ai) bi++;
        const kA = movableKeys[ai], kB = movableKeys[bi];
        const pA = allPos.get(kA), pB = allPos.get(kB);
        if (!pA || !pB) continue;
        newPos.set(kA, pB);
        newPos.set(kB, pA);
        const dA = getRotatedDims(footprintInfoMap.get(kA)!, newRot.get(kA) ?? 0);
        const dB = getRotatedDims(footprintInfoMap.get(kB)!, newRot.get(kB) ?? 0);
        if (pB.x + dA.w > boardW || pB.y + dA.h > boardH) continue;
        if (pA.x + dB.w > boardW || pA.y + dB.h > boardH) continue;
        if (hasOverlap(pB.x, pB.y, dA.w, dA.h, newPos, footprintInfoMap, newRot, kA)) continue;
        if (hasOverlap(pA.x, pA.y, dB.w, dB.h, newPos, footprintInfoMap, newRot, kB)) continue;
      } else if (r < 0.85) {
        const idx = Math.floor(Math.random() * movableKeys.length);
        const key = movableKeys[idx];
        const dims = getRotatedDims(footprintInfoMap.get(key)!, newRot.get(key) ?? 0);
        const cur = allPos.get(key);
        if (!cur) continue;
        const dx = Math.round((Math.random() - 0.5) * 4);
        const dy = Math.round((Math.random() - 0.5) * 4);
        const nx = Math.max(0, Math.min(boardW - dims.w, cur.x + dx));
        const ny = Math.max(0, Math.min(boardH - dims.h, cur.y + dy));
        if (nx === cur.x && ny === cur.y) continue;
        newPos.set(key, { x: nx, y: ny });
        if (hasOverlap(nx, ny, dims.w, dims.h, newPos, footprintInfoMap, newRot, key)) continue;
      } else {
        const idx = Math.floor(Math.random() * movableKeys.length);
        const key = movableKeys[idx];
        const curRot = newRot.get(key) ?? 0;
        const newRotVal = ((curRot + 1 + Math.floor(Math.random() * 3)) % 4) as Rotation;
        newRot.set(key, newRotVal);
        const dims = getRotatedDims(footprintInfoMap.get(key)!, newRotVal);
        const p = allPos.get(key);
        if (!p) continue;
        if (p.x + dims.w > boardW || p.y + dims.h > boardH) continue;
        if (hasOverlap(p.x, p.y, dims.w, dims.h, newPos, footprintInfoMap, newRot, key)) continue;
      }

      const evalPos = new Map<string, Position>();
      for (const k of movableKeys) {
        const p = newPos.get(k);
        if (p) evalPos.set(k, p);
      }
      const newCost = evaluateSolution(evalPos, newRot);
      if (newCost < bestCost) {
        bestPos = evalPos;
        bestRot = new Map(newRot);
        bestCost = newCost;
      }
    }
    return { positions: bestPos, rotations: bestRot, cost: bestCost };
  };

  // === Main ACO loop ===
  for (let iter = 0; iter < numIterations; iter++) {
    if (deadline && Date.now() > deadline) break;

    // Collect all ants' solutions (needed for AS and Rank-Based)
    const antSolutions: Array<{ positions: Map<string, Position>; rotations: Map<string, Rotation>; cost: number }> = [];

    for (let ant = 0; ant < numAnts; ant++) {
      if (deadline && Date.now() > deadline) break;
      const { positions, rotations } = constructAnt(ant, iter);
      const cost = evaluateSolution(positions, rotations);
      antSolutions.push({ positions, rotations, cost });
    }

    // Find iteration best
    antSolutions.sort((a, b) => a.cost - b.cost);
    let iterBestPos = antSolutions[0]?.positions ?? globalBestPos;
    let iterBestRot = antSolutions[0]?.rotations ?? globalBestRot;
    let iterBestCost = antSolutions[0]?.cost ?? Infinity;

    if (doLocalSearch && iterBestCost < Infinity) {
      const improved = localSearch(iterBestPos, iterBestRot, iterBestCost);
      iterBestPos = improved.positions;
      iterBestRot = improved.rotations;
      iterBestCost = improved.cost;
    }

    if (iterBestCost < globalBestCost) {
      globalBestCost = iterBestCost;
      globalBestPos = new Map(iterBestPos);
      globalBestRot = new Map(iterBestRot);
    }

    // ── Pheromone evaporation ──
    const useBounds = variant === "mmas" || variant === "rank-based";
    for (const [, trails] of pheromone) {
      for (const [posKey, val] of trails) {
        const evaporated = val * (1 - rho);
        trails.set(posKey, useBounds ? Math.max(minPheromone, evaporated) : Math.max(0.001, evaporated));
      }
    }

    // ── Pheromone deposit (variant-specific) ──
    const depositOnSolution = (
      sol: { positions: Map<string, Position>; rotations: Map<string, Rotation>; cost: number },
      amount: number,
    ) => {
      for (const [partKey, pos] of sol.positions) {
        const rot = sol.rotations.get(partKey) ?? 0;
        const pKey = `${pos.x},${pos.y},${rot}`;
        const trails = pheromone.get(partKey);
        if (trails) {
          const cur = trails.get(pKey) ?? pheromoneInit;
          trails.set(pKey, useBounds ? Math.min(maxPheromone, cur + amount) : cur + amount);
        }
      }
    };

    if (variant === "as") {
      // AS: ALL ants deposit proportional to solution quality
      for (const sol of antSolutions) {
        if (sol.cost < Infinity) {
          depositOnSolution(sol, Q_val / Math.max(sol.cost, 1));
        }
      }
    } else if (variant === "acs") {
      // ACS: Only global best deposits
      if (globalBestCost < Infinity) {
        depositOnSolution(
          { positions: globalBestPos, rotations: globalBestRot, cost: globalBestCost },
          Q_val / Math.max(globalBestCost, 1),
        );
      }
    } else if (variant === "rank-based") {
      // Rank-Based: Top W ants deposit, weighted by rank
      const topW = Math.min(rankW, antSolutions.length);
      for (let r = 0; r < topW; r++) {
        const sol = antSolutions[r];
        if (sol.cost < Infinity) {
          const weight = topW - r; // rank 0 gets highest weight
          depositOnSolution(sol, weight * Q_val / Math.max(sol.cost, 1));
        }
      }
    } else {
      // MMAS (default): iteration-best deposits + elitist global-best
      if (iterBestCost < Infinity) {
        depositOnSolution(
          { positions: iterBestPos, rotations: iterBestRot, cost: iterBestCost },
          Q_val / Math.max(iterBestCost, 1),
        );
      }
      if (elitistWeight > 0 && globalBestCost < Infinity) {
        depositOnSolution(
          { positions: globalBestPos, rotations: globalBestRot, cost: globalBestCost },
          elitistWeight * Q_val / Math.max(globalBestCost, 1),
        );
      }
    }
  }

  return { positions: globalBestPos, rotations: globalBestRot, cost: globalBestCost };
}

// ─── Beam MCTS placement ───
// Level-by-level beam search where at each depth we place one part.
// Each candidate is evaluated by running greedy rollouts for remaining parts
// and scoring with HPWL. Final top candidates are re-evaluated with actual routing.

function generateMCTSCandidates(
  partKey: string,
  footprintInfoMap: Map<string, FootprintInfo>,
  placed: Map<string, Position>,
  rotations: Map<string, Rotation>,
  nets: PlacementNet[],
  boardW: number,
  boardH: number,
  maxCandidates: number = 24,
  targetedRatio: number = 0,
  connections?: Map<string, Map<string, number>>,
): Array<{ x: number; y: number; rot: Rotation }> {
  const results: Array<{ x: number; y: number; rot: Rotation; score: number }> = [];
  const info = footprintInfoMap.get(partKey)!;

  for (const rot of [0, 1, 2, 3] as Rotation[]) {
    const dims = getRotatedDims(info, rot);
    const seen = new Set<string>();

    const tryCandidate = (cx: number, cy: number) => {
      const k = `${cx},${cy},${rot}`;
      if (seen.has(k)) return;
      seen.add(k);
      if (cx < 0 || cy < 0 || cx + dims.w > boardW || cy + dims.h > boardH) return;
      if (hasOverlap(cx, cy, dims.w, dims.h, placed, footprintInfoMap, rotations, partKey)) return;

      const tempRot = new Map(rotations);
      tempRot.set(partKey, rot);
      const wl = wireLength(partKey, { x: cx, y: cy }, nets, placed, footprintInfoMap, tempRot);

      let minBBX = cx, maxBBX = cx + dims.w, minBBY = cy, maxBBY = cy + dims.h;
      for (const [pk, pp] of placed) {
        const pi = footprintInfoMap.get(pk);
        if (!pi) continue;
        const pd = getRotatedDims(pi, rotations.get(pk) ?? 0);
        minBBX = Math.min(minBBX, pp.x);
        maxBBX = Math.max(maxBBX, pp.x + pd.w);
        minBBY = Math.min(minBBY, pp.y);
        maxBBY = Math.max(maxBBY, pp.y + pd.h);
      }
      const bbArea = (maxBBX - minBBX) * (maxBBY - minBBY);

      results.push({ x: cx, y: cy, rot, score: wl * 3 + bbArea * 4 });
    };

    // Adjacent to each placed part
    for (const [pk, pos] of placed) {
      const oi = footprintInfoMap.get(pk);
      if (!oi) continue;
      const od = getRotatedDims(oi, rotations.get(pk) ?? 0);

      for (let dy = -dims.h + 1; dy < od.h; dy += Math.max(1, Math.floor(od.h / 3))) {
        tryCandidate(pos.x + od.w, pos.y + dy);
        tryCandidate(pos.x - dims.w, pos.y + dy);
      }
      for (let dx = -dims.w + 1; dx < od.w; dx += Math.max(1, Math.floor(od.w / 3))) {
        tryCandidate(pos.x + dx, pos.y + od.h);
        tryCandidate(pos.x + dx, pos.y - dims.h);
      }
      tryCandidate(pos.x, pos.y + od.h);
      tryCandidate(pos.x, pos.y - dims.h);
      tryCandidate(pos.x + od.w, pos.y);
      tryCandidate(pos.x - dims.w, pos.y);
    }

    // Targeted sampling: generate candidates near connected pins
    if (targetedRatio > 0 && connections) {
      const connMap = connections.get(partKey);
      if (connMap) {
        const spread = Math.max(6, Math.floor(Math.max(boardW, boardH) * 0.3));
        const samplesPerConn = Math.max(3, Math.ceil(maxCandidates * targetedRatio / Math.max(connMap.size, 1)));
        for (const [connKey] of connMap) {
          const connPos = placed.get(connKey);
          if (!connPos) continue;
          const connInfo = footprintInfoMap.get(connKey);
          if (!connInfo) continue;
          const connDims = getRotatedDims(connInfo, rotations.get(connKey) ?? 0);
          // Sample positions around the connected part
          for (let s = 0; s < samplesPerConn; s++) {
            const rx = connPos.x + Math.floor((Math.random() - 0.5) * spread * 2);
            const ry = connPos.y + Math.floor((Math.random() - 0.5) * spread * 2);
            tryCandidate(Math.max(0, Math.min(boardW - dims.w, rx)), Math.max(0, Math.min(boardH - dims.h, ry)));
            // Also try right next to the connected part (adjacent positions)
            if (s === 0) {
              tryCandidate(connPos.x + connDims.w, connPos.y);
              tryCandidate(connPos.x - dims.w, connPos.y);
              tryCandidate(connPos.x, connPos.y + connDims.h);
              tryCandidate(connPos.x, connPos.y - dims.h);
            }
          }
        }
      }
    }

    // Origin area if nothing placed yet
    if (placed.size === 0) {
      tryCandidate(0, 0);
      tryCandidate(Math.floor((boardW - dims.w) / 2), Math.floor((boardH - dims.h) / 2));
    }
  }

  // Sort by HPWL score (best first) and limit candidates
  results.sort((a, b) => a.score - b.score);
  return results.slice(0, maxCandidates).map(({ x, y, rot }) => ({ x, y, rot }));
}

// ─── Integrated placement + routing ───
// Places parts one at a time, evaluating actual A* routing for each candidate position.
// Routing quality drives every placement decision from the first part onward.

function integratedPlacement(
  unplacedKeys: string[],
  allKeys: string[],
  footprintInfoMap: Map<string, FootprintInfo>,
  fixedPositions: Map<string, Position>,
  initialRotations: Map<string, Rotation>,
  nets: PlacementNet[],
  parts: Record<string, Part>,
  parsedKiCadDoc: any,
  routingCosts: RoutingCosts,
  boardW: number,
  boardH: number,
  maxJumpers?: number,
  deadline?: number,
  seed?: number,
  flexVariantsMap?: Map<string, FlexVariant[]>,
  boardType?: "perfboard" | "stripboard",
  advancedConfig?: AdvancedConfig,
): { positions: Map<string, Position>; rotations: Map<string, Rotation>; cost: number } {
  if (unplacedKeys.length === 0) {
    return { positions: new Map(), rotations: initialRotations, cost: 0 };
  }

  const connections = buildPartConnections(nets);

  // Sort: largest area first (anchor the layout), then most connected
  // With seed > 0, partially randomize order to explore different placements
  let sortedKeys = [...unplacedKeys].sort((a, b) => {
    const areaA = footprintInfoMap.get(a)!.w * footprintInfoMap.get(a)!.h;
    const areaB = footprintInfoMap.get(b)!.w * footprintInfoMap.get(b)!.h;
    if (areaB !== areaA) return areaB - areaA;
    const connA = connections.get(a)?.size ?? 0;
    const connB = connections.get(b)?.size ?? 0;
    return connB - connA;
  });
  if (seed && seed > 0 && sortedKeys.length > 1) {
    // Shuffle all parts (including first) so retries explore fundamentally different layouts
    let s = seed;
    for (let i = sortedKeys.length - 1; i > 0; i--) {
      s = (s * 1664525 + 1013904223) >>> 0;
      const j = s % (i + 1);
      [sortedKeys[i], sortedKeys[j]] = [sortedKeys[j], sortedKeys[i]];
    }
  }

  const placed = new Map<string, Position>(fixedPositions);
  const rotations = new Map<string, Rotation>(initialRotations);
  const COMPACTNESS_WEIGHT = advancedConfig?.compactnessWeight ?? 3;
  const MAX_CANDIDATES = advancedConfig?.candidateListSize ?? 20;
  const beautyGroups = maybeBuildBeautyGroups(advancedConfig?.beautyFilter, parts, footprintInfoMap);

  // Track which parts got flex shapes (so we can update footprintInfoMap)
  const flexChoices = new Map<string, FlexVariant>();

  for (const partKey of sortedKeys) {
    if (deadline && Date.now() > deadline) break;
    const info = footprintInfoMap.get(partKey)!;
    const flexVariants = flexVariantsMap?.get(partKey);

    // Generate candidate positions
    let candidates: Array<{ x: number; y: number; rot: Rotation }>;

    if (placed.size === 0) {
      // First part: try all 4 rotations at origin
      candidates = ([0, 1, 2, 3] as Rotation[]).map(rot => ({ x: 0, y: 0, rot }));
    } else {
      candidates = generateMCTSCandidates(
        partKey, footprintInfoMap, placed, rotations,
        nets, boardW, boardH, MAX_CANDIDATES
      );
    }

    if (candidates.length === 0 && (!flexVariants || flexVariants.length === 0)) {
      // Fallback: greedy placement, trying all rotations
      let found = false;
      for (const tryRot of [0, 1, 2, 3] as Rotation[]) {
        rotations.set(partKey, tryRot);
        const dims = getRotatedDims(info, tryRot);
        const pos = findBestPosition(partKey, dims.w, dims.h, placed, footprintInfoMap, rotations, nets, boardW, boardH);
        if (pos) { placed.set(partKey, pos); found = true; break; }
      }
      if (!found) rotations.set(partKey, initialRotations.get(partKey) ?? 0);
      continue;
    }

    let bestScore = Infinity;
    let bestCandidate: { x: number; y: number; rot: Rotation } | null = null;
    let bestFlexVariant: FlexVariant | null = null;

    // Helper to evaluate a candidate position/rotation with a given footprint shape
    const evalCandidate = (
      cand: { x: number; y: number; rot: Rotation },
      shapeInfo: FootprintInfo,
    ): number => {
      const tempPlaced = new Map(placed);
      tempPlaced.set(partKey, { x: cand.x, y: cand.y });
      const tempRot = new Map(rotations);
      tempRot.set(partKey, cand.rot);

      // Temporarily swap the footprint info for this part
      const origInfo = footprintInfoMap.get(partKey)!;
      footprintInfoMap.set(partKey, shapeInfo);

      const placedKeys = [...tempPlaced.keys()];
      const placements = buildPlacementsFromPositions(placedKeys, tempPlaced, tempRot, footprintInfoMap);

      let bCols = 0, bRows = 0;
      for (const p of placements) {
        bCols = Math.max(bCols, p.offsetX + p.width);
        bRows = Math.max(bRows, p.offsetY + p.height);
      }
      bCols += 3;
      bRows += 3;

      const partialNets = extractNets(placements, parts, parsedKiCadDoc);
      const compactness = computeCompactnessCost(tempPlaced, footprintInfoMap, tempRot);

      // Always route — no HPWL proxies, integrated place-and-route only
      const routingResult = routeNets(partialNets, placements, routingCosts, bCols, bRows, maxJumpers, true, deadline, boardType);
      const routingScore = routingResult.totalCost;

      let hpwlLookahead = 0;
      for (const net of nets) {
        const placedPins: Array<{ x: number; y: number }> = [];
        let hasUnplaced = false;
        for (const pin of net.pins) {
          const pos = tempPlaced.get(pin.partKey);
          if (pos) {
            const pinInfo = footprintInfoMap.get(pin.partKey);
            if (pinInfo) {
              const rot = tempRot.get(pin.partKey) ?? 0;
              const rp = rotateLocalPin(pin.localX, pin.localY, pinInfo.w, pinInfo.h, rot);
              placedPins.push({ x: pos.x + rp.x, y: pos.y + rp.y });
            }
          } else {
            hasUnplaced = true;
          }
        }
        if (hasUnplaced && placedPins.length >= 1) {
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          for (const p of placedPins) {
            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
          }
          hpwlLookahead += (maxX - minX) + (maxY - minY);
        }
      }

      // Restore original footprint info
      footprintInfoMap.set(partKey, origInfo);

      const perimeter = 2 * (bCols + bRows);
      let score = routingScore + compactness * COMPACTNESS_WEIGHT + perimeter * COMPACTNESS_WEIGHT * 2 + hpwlLookahead * 0.5;
      if (beautyGroups) {
        score += computeBeautyCost(beautyGroups, tempPlaced, tempRot, footprintInfoMap);
      }
      return score;
    };

    // Evaluate standard candidates (default shape)
    for (const cand of candidates) {
      const score = evalCandidate(cand, info);
      if (score < bestScore) {
        bestScore = score;
        bestCandidate = cand;
        bestFlexVariant = null;
      }
    }

    // Also try flex variants if this part has them
    if (flexVariants && flexVariants.length > 0) {
      for (const variant of flexVariants) {
        // Skip the default straight shape — already covered above
        if (variant.h === 1 && variant.w === info.w) continue;
        if (variant.w === 1 && variant.h === info.w) continue;

        const variantInfo: FootprintInfo = { pins: variant.pins, w: variant.w, h: variant.h };

        // Generate candidates for this shape using a temporary footprint info swap
        const origInfo = footprintInfoMap.get(partKey)!;
        footprintInfoMap.set(partKey, variantInfo);

        let variantCandidates: Array<{ x: number; y: number; rot: Rotation }>;
        if (placed.size === 0) {
          variantCandidates = ([0, 1] as Rotation[]).map(rot => ({ x: 0, y: 0, rot }));
        } else {
          variantCandidates = generateMCTSCandidates(
            partKey, footprintInfoMap, placed, rotations,
            nets, boardW, boardH, 8 // fewer candidates per variant for speed
          );
        }
        footprintInfoMap.set(partKey, origInfo);

        for (const cand of variantCandidates) {
          const score = evalCandidate(cand, variantInfo);
          if (score < bestScore) {
            bestScore = score;
            bestCandidate = cand;
            bestFlexVariant = variant;
          }
        }
      }
    }

    // Commit the best candidate
    if (bestCandidate) {
      placed.set(partKey, { x: bestCandidate.x, y: bestCandidate.y });
      rotations.set(partKey, bestCandidate.rot);
      if (bestFlexVariant) {
        // Update footprintInfoMap with the chosen flex shape
        footprintInfoMap.set(partKey, { pins: bestFlexVariant.pins, w: bestFlexVariant.w, h: bestFlexVariant.h });
        flexChoices.set(partKey, bestFlexVariant);
      }
    }
  }

  // Extract movable positions
  const movablePos = new Map<string, Position>();
  for (const k of unplacedKeys) {
    const p = placed.get(k);
    if (p) movablePos.set(k, p);
  }

  // Phase 2: ACO refinement — ant colony explores placement + routing together
  const refined = antColonyPlacementAndRouting(
    movablePos, unplacedKeys, allKeys, footprintInfoMap,
    fixedPositions, rotations, nets, parts, parsedKiCadDoc,
    routingCosts, boardW, boardH, maxJumpers, deadline,
    boardType, advancedConfig,
  );
  return refined;
}


// ─── Board sizing ───

function estimateBoardSize(
  footprintInfoMap: Map<string, FootprintInfo>,
  unplacedKeys: string[],
  fixedPlacements: PartPlacement[],
  minCols: number,
  minRows: number,
  maxCols?: number,
  maxRows?: number,
  boardType?: "perfboard" | "stripboard",
  customAreaMultiplier?: number,
): { boardW: number; boardH: number } {
  let totalArea = 0;
  let maxW = 0;
  let maxH = 0;

  for (const key of unplacedKeys) {
    const info = footprintInfoMap.get(key);
    if (!info) continue;
    totalArea += info.w * info.h;
    maxW = Math.max(maxW, info.w);
    maxH = Math.max(maxH, info.h);
  }

  let fixedMaxX = 0;
  let fixedMaxY = 0;
  for (const p of fixedPlacements) {
    fixedMaxX = Math.max(fixedMaxX, p.offsetX + p.width);
    fixedMaxY = Math.max(fixedMaxY, p.offsetY + p.height);
  }

  // Board needs room for parts + routing channels
  // Stripboard needs more vertical space because same-row conflicts require vertical separation
  const areaMultiplier = customAreaMultiplier ?? (boardType === "stripboard" ? 5.0 : 2.5);
  const side = Math.ceil(Math.sqrt(totalArea * areaMultiplier));
  let boardW = Math.max(maxW + 2, side, fixedMaxX + 2, minCols);
  let boardH = Math.max(maxH + 2, Math.ceil(totalArea / boardW) + 2, fixedMaxY + 2, minRows);

  // Ensure the board is big enough for the largest part
  boardW = Math.max(boardW, maxW + 2);
  boardH = Math.max(boardH, maxH + 2);

  // Stripboard: add a few extra rows for vertical wire routing channels
  if (boardType === "stripboard") {
    boardH += Math.ceil(unplacedKeys.length * 0.5);
  }

  // Apply user constraints with cross-axis compensation:
  // constraining one axis must expand the other to fit all the parts
  const neededArea = totalArea * areaMultiplier;
  let minRequiredW = 0, minRequiredH = 0;
  for (const key of unplacedKeys) {
    const info = footprintInfoMap.get(key);
    if (!info) continue;
    minRequiredW = Math.max(minRequiredW, Math.min(info.w, info.h));
    minRequiredH = Math.max(minRequiredH, Math.min(info.w, info.h));
  }
  if (maxRows && maxRows > 0 && boardH > maxRows) {
    boardH = Math.max(maxRows, minRequiredH);
    boardW = Math.max(boardW, Math.ceil(neededArea / boardH));
  }
  if (maxCols && maxCols > 0 && boardW > maxCols) {
    boardW = Math.max(maxCols, minRequiredW);
    boardH = Math.max(boardH, Math.ceil(neededArea / boardW));
  }
  return { boardW, boardH };
}

function normalizePlacements(
  placements: PartPlacement[],
  minCols: number,
  minRows: number,
  rotations: Record<string, Rotation>,
  normalize: boolean
): PlacementResult {
  if (placements.length === 0) return { placements, boardCols: minCols, boardRows: minRows, rotations };

  let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
  for (const p of placements) {
    minX = Math.min(minX, p.offsetX);
    minY = Math.min(minY, p.offsetY);
    for (const pin of p.pins) {
      maxX = Math.max(maxX, pin.x);
      maxY = Math.max(maxY, pin.y);
    }
    maxX = Math.max(maxX, p.offsetX + p.width - 1);
    maxY = Math.max(maxY, p.offsetY + p.height - 1);
  }

  if (normalize) {
    const shiftX = minX;
    const shiftY = minY;
    if (shiftX !== 0 || shiftY !== 0) {
      for (const p of placements) {
        p.offsetX -= shiftX;
        p.offsetY -= shiftY;
        for (const pin of p.pins) {
          pin.x -= shiftX;
          pin.y -= shiftY;
        }
      }
      maxX -= shiftX;
      maxY -= shiftY;
    }
  }

  return {
    placements,
    boardCols: Math.max(maxX + 1, minCols),
    boardRows: Math.max(maxY + 1, minRows),
    rotations,
  };
}

// ─── SA Placement ───

function saPlacement(
  unplacedKeys: string[],
  allKeys: string[],
  footprintInfoMap: Map<string, FootprintInfo>,
  fixedPositions: Map<string, Position>,
  initialRotations: Map<string, Rotation>,
  nets: PlacementNet[],
  parts: Record<string, Part>,
  parsedKiCadDoc: any,
  routingCosts: RoutingCosts,
  boardW: number,
  boardH: number,
  maxJumpers?: number,
  deadline?: number,
  boardType?: "perfboard" | "stripboard",
  config?: AdvancedConfig,
): { positions: Map<string, Position>; rotations: Map<string, Rotation>; cost: number } {
  const compactnessWeight = config?.compactnessWeight ?? 3;
  let T = config?.saTemperature ?? 50;
  const coolingRate = config?.saCoolingRate ?? 0.95;
  const innerIter = config?.saInnerIter ?? 30;
  const beautyGroups = maybeBuildBeautyGroups(config?.beautyFilter, parts, footprintInfoMap);

  const evaluate = (pos: Map<string, Position>, rots: Map<string, Rotation>): number =>
    evaluateFullRouting(pos, rots, allKeys, fixedPositions, footprintInfoMap,
      parts, parsedKiCadDoc, routingCosts, maxJumpers, deadline, boardType, compactnessWeight, beautyGroups);

  // Start from greedy constructive placement
  const initial = integratedPlacement(
    unplacedKeys, allKeys, footprintInfoMap, fixedPositions, initialRotations,
    nets, parts, parsedKiCadDoc, routingCosts, boardW, boardH,
    maxJumpers, deadline, 42, undefined, boardType, config,
  );
  const currentPos = new Map(initial.positions);
  const currentRot = new Map(initial.rotations);
  let currentCost = evaluate(currentPos, currentRot);
  let bestPos = new Map(currentPos);
  let bestRot = new Map(currentRot);
  let bestCost = currentCost;

  // SA main loop
  let rng = 12345;
  const nextRng = () => { rng = (rng * 1664525 + 1013904223) >>> 0; return rng / 0x100000000; };
  let swapKey2: string | null = null;
  let swapKey2OldPos: Position | null = null;

  while (T > 0.5) {
    if (deadline && Date.now() > deadline) break;
    for (let i = 0; i < innerIter; i++) {
      if (deadline && Date.now() > deadline) break;
      const moveType = nextRng();
      const keyIdx = Math.floor(nextRng() * unplacedKeys.length);
      const key = unplacedKeys[keyIdx];
      const oldPos = currentPos.get(key)!;
      const oldRot = currentRot.get(key) ?? 0;

      if (moveType < 0.5) {
        // Shift by ±1-3
        const dx = Math.floor(nextRng() * 7) - 3;
        const dy = Math.floor(nextRng() * 7) - 3;
        const info = footprintInfoMap.get(key)!;
        const { w, h } = getRotatedDims(info, oldRot);
        const nx = Math.max(0, Math.min(boardW - w, oldPos.x + dx));
        const ny = Math.max(0, Math.min(boardH - h, oldPos.y + dy));
        if (nx === oldPos.x && ny === oldPos.y) continue;
        const allShiftPos = new Map([...fixedPositions, ...currentPos]);
        if (hasOverlap(nx, ny, w, h, allShiftPos, footprintInfoMap, currentRot, key)) continue;
        currentPos.set(key, { x: nx, y: ny });
      } else if (moveType < 0.8) {
        // Rotate
        const newRotVal = ((oldRot + 1) % 4) as Rotation;
        currentRot.set(key, newRotVal);
        const info = footprintInfoMap.get(key)!;
        const { w, h } = getRotatedDims(info, newRotVal);
        const nx = Math.max(0, Math.min(oldPos.x, boardW - w));
        const ny = Math.max(0, Math.min(oldPos.y, boardH - h));
        if (nx + w > boardW || ny + h > boardH) { currentRot.set(key, oldRot); continue; }
        const allRotPos = new Map([...fixedPositions, ...currentPos]);
        if (hasOverlap(nx, ny, w, h, allRotPos, footprintInfoMap, currentRot, key)) { currentRot.set(key, oldRot); continue; }
        currentPos.set(key, { x: nx, y: ny });
      } else {
        // Swap two components
        const key2Idx = Math.floor(nextRng() * unplacedKeys.length);
        swapKey2 = unplacedKeys[key2Idx];
        if (swapKey2 !== key) {
          swapKey2OldPos = currentPos.get(swapKey2)!;
          currentPos.set(key, swapKey2OldPos);
          currentPos.set(swapKey2, oldPos);
          // Validate swap: bounds + overlap
          const ki = footprintInfoMap.get(key)!, oi = footprintInfoMap.get(swapKey2)!;
          const kr = currentRot.get(key) ?? 0, or_ = currentRot.get(swapKey2) ?? 0;
          const kd = getRotatedDims(ki, kr), od = getRotatedDims(oi, or_);
          if (swapKey2OldPos.x + kd.w > boardW || swapKey2OldPos.y + kd.h > boardH || oldPos.x + od.w > boardW || oldPos.y + od.h > boardH) {
            currentPos.set(key, oldPos); currentPos.set(swapKey2, swapKey2OldPos); swapKey2 = null; continue;
          }
          const allP = new Map([...fixedPositions, ...currentPos]);
          if (hasOverlap(swapKey2OldPos.x, swapKey2OldPos.y, kd.w, kd.h, allP, footprintInfoMap, currentRot, key) ||
              hasOverlap(oldPos.x, oldPos.y, od.w, od.h, allP, footprintInfoMap, currentRot, swapKey2)) {
            currentPos.set(key, oldPos); currentPos.set(swapKey2, swapKey2OldPos); swapKey2 = null; continue;
          }
        } else {
          swapKey2 = null;
        }
      }

      const newCost = evaluate(currentPos, currentRot);
      const delta = newCost - currentCost;
      if (delta < 0 || nextRng() < Math.exp(-delta / T)) {
        currentCost = newCost;
        if (currentCost < bestCost) {
          bestCost = currentCost;
          bestPos = new Map(currentPos);
          bestRot = new Map(currentRot);
        }
      } else {
        // Revert
        currentPos.set(key, oldPos);
        currentRot.set(key, oldRot);
        if (swapKey2 && swapKey2OldPos) {
          currentPos.set(swapKey2, swapKey2OldPos);
        }
      }
      swapKey2 = null;
      swapKey2OldPos = null;
    }
    T *= coolingRate;
  }

  return { positions: bestPos, rotations: bestRot, cost: bestCost };
}

// ─── Genetic Algorithm Placement ───

function gaPlacement(
  unplacedKeys: string[],
  allKeys: string[],
  footprintInfoMap: Map<string, FootprintInfo>,
  fixedPositions: Map<string, Position>,
  initialRotations: Map<string, Rotation>,
  nets: PlacementNet[],
  parts: Record<string, Part>,
  parsedKiCadDoc: any,
  routingCosts: RoutingCosts,
  boardW: number,
  boardH: number,
  maxJumpers?: number,
  deadline?: number,
  boardType?: "perfboard" | "stripboard",
  config?: AdvancedConfig,
): { positions: Map<string, Position>; rotations: Map<string, Rotation>; cost: number } {
  const popSize = config?.gaPopSize ?? 20;
  const generations = config?.gaGenerations ?? 30;
  const crossoverRate = config?.gaCrossoverRate ?? 0.7;
  const mutationRate = config?.gaMutationRate ?? 0.3;
  const compactnessWeight = config?.compactnessWeight ?? 3;
  const beautyGroups = maybeBuildBeautyGroups(config?.beautyFilter, parts, footprintInfoMap);

  type Individual = { positions: Map<string, Position>; rotations: Map<string, Rotation>; cost: number };

  function evaluateIndividual(positions: Map<string, Position>, rotations: Map<string, Rotation>): number {
    // Penalize incomplete placements — prevents degenerate "empty is best" collapse
    const missingCount = unplacedKeys.filter(k => !positions.has(k)).length;
    if (missingCount > 0) return missingCount * 1000000;

    return evaluateFullRouting(positions, rotations, allKeys, fixedPositions, footprintInfoMap,
      parts, parsedKiCadDoc, routingCosts, maxJumpers, deadline, boardType, compactnessWeight, beautyGroups);
  }

  function makeRandomIndividual(): Individual {
    const positions = new Map<string, Position>();
    const rotations = new Map<string, Rotation>(initialRotations);
    const occupied = new Set<string>();
    for (const [key, pos] of fixedPositions) {
      const info = footprintInfoMap.get(key);
      if (!info) continue;
      const rot = rotations.get(key) ?? 0;
      const { w, h } = getRotatedDims(info, rot);
      for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) occupied.add(`${pos.x + dx},${pos.y + dy}`);
    }
    const shuffled = [...unplacedKeys].sort(() => Math.random() - 0.5);
    for (const key of shuffled) {
      const info = footprintInfoMap.get(key);
      if (!info) continue;
      const rot: Rotation = Math.floor(Math.random() * 4) as Rotation;
      rotations.set(key, rot);
      const { w, h } = getRotatedDims(info, rot);
      let placed = false;
      for (let attempt = 0; attempt < 100 && !placed; attempt++) {
        const x = Math.floor(Math.random() * Math.max(1, boardW - w));
        const y = Math.floor(Math.random() * Math.max(1, boardH - h));
        let blocked = false;
        for (let cy = 0; cy < h && !blocked; cy++)
          for (let cx = 0; cx < w && !blocked; cx++)
            if (occupied.has(`${x + cx},${y + cy}`)) blocked = true;
        if (!blocked) {
          positions.set(key, { x, y });
          for (let cy = 0; cy < h; cy++) for (let cx = 0; cx < w; cx++) occupied.add(`${x + cx},${y + cy}`);
          placed = true;
        }
      }
      if (!placed) positions.set(key, { x: 0, y: 0 });
    }
    return { positions, rotations, cost: evaluateIndividual(positions, rotations) };
  }

  function legalize(positions: Map<string, Position>, rotations: Map<string, Rotation>): void {
    const occupied = new Set<string>();
    for (const [key, pos] of fixedPositions) {
      const info = footprintInfoMap.get(key);
      if (!info) continue;
      const rot = rotations.get(key) ?? 0;
      const { w, h } = getRotatedDims(info, rot);
      for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) occupied.add(`${pos.x + dx},${pos.y + dy}`);
    }
    for (const key of unplacedKeys) {
      const info = footprintInfoMap.get(key);
      if (!info) continue;
      const rot = rotations.get(key) ?? 0;
      const { w, h } = getRotatedDims(info, rot);
      const target = positions.get(key) ?? { x: 0, y: 0 };
      let placed = false;
      for (let radius = 0; radius < boardW + boardH && !placed; radius++) {
        for (let dy = -radius; dy <= radius && !placed; dy++) {
          for (let dx = -radius; dx <= radius && !placed; dx++) {
            if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
            const x = target.x + dx, y = target.y + dy;
            if (x < 0 || y < 0 || x + w > boardW || y + h > boardH) continue;
            let blocked = false;
            for (let cy = 0; cy < h && !blocked; cy++)
              for (let cx = 0; cx < w && !blocked; cx++)
                if (occupied.has(`${x + cx},${y + cy}`)) blocked = true;
            if (!blocked) {
              positions.set(key, { x, y });
              for (let cy = 0; cy < h; cy++) for (let cx = 0; cx < w; cx++) occupied.add(`${x + cx},${y + cy}`);
              placed = true;
            }
          }
        }
      }
      if (!placed) {
        // Fallback: force-place at target (even if overlapping) so no part goes missing
        const fx = Math.max(0, Math.min(target.x, boardW - w));
        const fy = Math.max(0, Math.min(target.y, boardH - h));
        positions.set(key, { x: fx, y: fy });
        for (let cy = 0; cy < h; cy++) for (let cx = 0; cx < w; cx++) occupied.add(`${fx + cx},${fy + cy}`);
      }
    }
  }

  // Initialize population: 2 greedy seeds + rest random
  // Give each greedy seed a limited time budget (20% of total) to avoid hogging the deadline
  const population: Individual[] = [];
  const seedCount = Math.min(2, popSize);
  const timePerSeed = deadline ? Math.max(2000, Math.floor((deadline - Date.now()) * 0.2)) : undefined;
  for (let seed = 0; seed < seedCount; seed++) {
    if (deadline && Date.now() > deadline) break;
    try {
      const seedDeadline = timePerSeed ? Date.now() + timePerSeed : undefined;
      const greedy = integratedPlacement(unplacedKeys, allKeys, footprintInfoMap, fixedPositions, initialRotations, nets, parts, parsedKiCadDoc, routingCosts, boardW, boardH, maxJumpers, seedDeadline, seed, undefined, boardType, config);
      // Re-evaluate with evaluateIndividual for consistent scoring (catches empty/incomplete results)
      const cost = evaluateIndividual(greedy.positions, greedy.rotations);
      population.push({ positions: greedy.positions, rotations: greedy.rotations, cost });
    } catch { population.push(makeRandomIndividual()); }
  }
  while (population.length < popSize) population.push(makeRandomIndividual());

  let bestEver: Individual = population.reduce((a, b) => a.cost < b.cost ? a : b);

  for (let gen = 0; gen < generations; gen++) {
    if (deadline && Date.now() > deadline) break;

    // Sort by fitness
    population.sort((a, b) => a.cost - b.cost);

    const newPop: Individual[] = [];
    // Elitism: keep top 2
    newPop.push(population[0], population[1]);

    while (newPop.length < popSize) {
      // Tournament selection
      const selectParent = (): Individual => {
        const a = population[Math.floor(Math.random() * popSize)];
        const b = population[Math.floor(Math.random() * popSize)];
        const c = population[Math.floor(Math.random() * popSize)];
        return a.cost <= b.cost ? (a.cost <= c.cost ? a : c) : (b.cost <= c.cost ? b : c);
      };
      const parentA = selectParent();
      const parentB = selectParent();

      // Crossover
      const childPos = new Map<string, Position>();
      const childRot = new Map<string, Rotation>(initialRotations);

      if (Math.random() < crossoverRate) {
        for (const key of unplacedKeys) {
          if (Math.random() < 0.5) {
            const p = parentA.positions.get(key) ?? parentB.positions.get(key);
            if (p) childPos.set(key, { ...p });
            const r = parentA.rotations.get(key) ?? parentB.rotations.get(key);
            if (r !== undefined) childRot.set(key, r);
          } else {
            const p = parentB.positions.get(key) ?? parentA.positions.get(key);
            if (p) childPos.set(key, { ...p });
            const r = parentB.rotations.get(key) ?? parentA.rotations.get(key);
            if (r !== undefined) childRot.set(key, r);
          }
        }
      } else {
        for (const key of unplacedKeys) {
          const p = parentA.positions.get(key);
          if (p) childPos.set(key, { ...p });
          const r = parentA.rotations.get(key);
          if (r !== undefined) childRot.set(key, r);
        }
      }

      // Mutation
      for (const key of unplacedKeys) {
        if (Math.random() < mutationRate) {
          const info = footprintInfoMap.get(key);
          if (!info) continue;
          const moveType = Math.random();
          if (moveType < 0.5) {
            // Shift
            const pos = childPos.get(key);
            if (pos) {
              const rot = childRot.get(key) ?? 0;
              const { w, h } = getRotatedDims(info, rot);
              const dx = Math.floor(Math.random() * 7) - 3;
              const dy = Math.floor(Math.random() * 7) - 3;
              childPos.set(key, { x: Math.max(0, Math.min(boardW - w, pos.x + dx)), y: Math.max(0, Math.min(boardH - h, pos.y + dy)) });
            }
          } else {
            // Rotate
            childRot.set(key, Math.floor(Math.random() * 4) as Rotation);
          }
        }
      }

      legalize(childPos, childRot);
      const cost = evaluateIndividual(childPos, childRot);
      newPop.push({ positions: childPos, rotations: childRot, cost });

      if (cost < bestEver.cost) bestEver = { positions: new Map(childPos), rotations: new Map(childRot), cost };
    }

    population.length = 0;
    population.push(...newPop);
  }

  return { positions: bestEver.positions, rotations: bestEver.rotations, cost: bestEver.cost };
}

// ─── Tabu Search Placement ───

function tabuPlacement(
  unplacedKeys: string[],
  allKeys: string[],
  footprintInfoMap: Map<string, FootprintInfo>,
  fixedPositions: Map<string, Position>,
  initialRotations: Map<string, Rotation>,
  nets: PlacementNet[],
  parts: Record<string, Part>,
  parsedKiCadDoc: any,
  routingCosts: RoutingCosts,
  boardW: number,
  boardH: number,
  maxJumpers?: number,
  deadline?: number,
  boardType?: "perfboard" | "stripboard",
  config?: AdvancedConfig,
): { positions: Map<string, Position>; rotations: Map<string, Rotation>; cost: number } {
  const tenure = config?.tabuTenure ?? 10;
  const maxIter = config?.tabuMaxIter ?? 200;
  const compactnessWeight = config?.compactnessWeight ?? 3;
  const beautyGroups = maybeBuildBeautyGroups(config?.beautyFilter, parts, footprintInfoMap);

  const evaluate = (positions: Map<string, Position>, rotations: Map<string, Rotation>): number =>
    evaluateFullRouting(positions, rotations, allKeys, fixedPositions, footprintInfoMap,
      parts, parsedKiCadDoc, routingCosts, maxJumpers, deadline, boardType, compactnessWeight, beautyGroups);

  // Start from greedy seed
  let current: { positions: Map<string, Position>; rotations: Map<string, Rotation>; cost: number };
  try {
    current = integratedPlacement(unplacedKeys, allKeys, footprintInfoMap, fixedPositions, initialRotations, nets, parts, parsedKiCadDoc, routingCosts, boardW, boardH, maxJumpers, deadline, 42, undefined, boardType, config);
  } catch {
    current = { positions: new Map<string, Position>(), rotations: new Map<string, Rotation>(initialRotations), cost: 999999 };
    let cx = 0;
    for (const key of unplacedKeys) {
      current.positions.set(key, { x: cx, y: 0 }); cx += (footprintInfoMap.get(key)?.w ?? 2) + 1;
    }
  }

  let bestEver = { positions: new Map(current.positions), rotations: new Map(current.rotations), cost: current.cost };
  const tabuList: Array<{ key: string; moveType: string; iteration: number }> = [];

  function isTabu(key: string, moveType: string, iter: number): boolean {
    return tabuList.some(t => t.key === key && t.moveType === moveType && t.iteration + tenure > iter);
  }

  for (let iter = 0; iter < maxIter; iter++) {
    if (deadline && Date.now() > deadline) break;

    // Generate neighborhood: try a few moves and pick best non-tabu
    let bestNeighbor: { positions: Map<string, Position>; rotations: Map<string, Rotation>; cost: number; moveKey: string; moveType: string } | null = null;

    const numNeighbors = Math.min(unplacedKeys.length * 3, 20);
    for (let n = 0; n < numNeighbors; n++) {
      const key = unplacedKeys[Math.floor(Math.random() * unplacedKeys.length)];
      const info = footprintInfoMap.get(key);
      if (!info) continue;

      const newPos = new Map(current.positions);
      const newRot = new Map(current.rotations);
      const moveType = Math.random() < 0.6 ? "shift" : Math.random() < 0.75 ? "rotate" : "swap";

      if (moveType === "shift") {
        const pos = newPos.get(key);
        if (!pos) continue;
        const rot = newRot.get(key) ?? 0;
        const { w, h } = getRotatedDims(info, rot);
        const dx = Math.floor(Math.random() * 7) - 3;
        const dy = Math.floor(Math.random() * 7) - 3;
        const nx = Math.max(0, Math.min(boardW - w, pos.x + dx));
        const ny = Math.max(0, Math.min(boardH - h, pos.y + dy));
        if (nx === pos.x && ny === pos.y) continue;
        if (hasOverlap(nx, ny, w, h, new Map([...fixedPositions, ...newPos]), footprintInfoMap, newRot, key)) continue;
        newPos.set(key, { x: nx, y: ny });
      } else if (moveType === "rotate") {
        const newR = ((newRot.get(key) ?? 0) + 1) % 4 as Rotation;
        newRot.set(key, newR);
        const pos = newPos.get(key);
        if (pos) {
          const { w, h } = getRotatedDims(info, newR);
          if (pos.x + w > boardW || pos.y + h > boardH) continue;
          if (hasOverlap(pos.x, pos.y, w, h, new Map([...fixedPositions, ...newPos]), footprintInfoMap, newRot, key)) continue;
        }
      } else {
        // Swap two parts
        const other = unplacedKeys[Math.floor(Math.random() * unplacedKeys.length)];
        if (other === key) continue;
        const p1 = newPos.get(key), p2 = newPos.get(other);
        if (!p1 || !p2) continue;
        newPos.set(key, { ...p2 });
        newPos.set(other, { ...p1 });
        // Check bounds and overlaps after swap
        const ki = footprintInfoMap.get(key)!, oi = footprintInfoMap.get(other)!;
        const kr = newRot.get(key) ?? 0, or_ = newRot.get(other) ?? 0;
        const kd = getRotatedDims(ki, kr), od = getRotatedDims(oi, or_);
        if (p2.x + kd.w > boardW || p2.y + kd.h > boardH || p1.x + od.w > boardW || p1.y + od.h > boardH) {
          newPos.set(key, { ...p1 }); newPos.set(other, { ...p2 }); continue;
        }
        const allSwapPos = new Map([...fixedPositions, ...newPos]);
        if (hasOverlap(p2.x, p2.y, kd.w, kd.h, allSwapPos, footprintInfoMap, newRot, key) ||
            hasOverlap(p1.x, p1.y, od.w, od.h, allSwapPos, footprintInfoMap, newRot, other)) {
          newPos.set(key, { ...p1 }); newPos.set(other, { ...p2 }); continue;
        }
      }

      // Skip if tabu (unless aspiration: improves global best)
      const tabu = isTabu(key, moveType, iter);
      const cost = evaluate(newPos, newRot);
      if (tabu && cost >= bestEver.cost) continue;

      if (!bestNeighbor || cost < bestNeighbor.cost) {
        bestNeighbor = { positions: newPos, rotations: newRot, cost, moveKey: key, moveType };
      }
    }

    if (bestNeighbor) {
      current = { positions: bestNeighbor.positions, rotations: bestNeighbor.rotations, cost: bestNeighbor.cost };
      tabuList.push({ key: bestNeighbor.moveKey, moveType: bestNeighbor.moveType, iteration: iter });
      // Prune old tabu entries
      while (tabuList.length > 0 && tabuList[0].iteration + tenure <= iter) tabuList.shift();
      if (current.cost < bestEver.cost) {
        bestEver = { positions: new Map(current.positions), rotations: new Map(current.rotations), cost: current.cost };
      }
    }
  }

  return bestEver;
}


// ─── Hill Climbing with Random Restarts ───

function hillClimbPlacement(
  unplacedKeys: string[],
  allKeys: string[],
  footprintInfoMap: Map<string, FootprintInfo>,
  fixedPositions: Map<string, Position>,
  initialRotations: Map<string, Rotation>,
  nets: PlacementNet[],
  parts: Record<string, Part>,
  parsedKiCadDoc: any,
  routingCosts: RoutingCosts,
  boardW: number,
  boardH: number,
  maxJumpers?: number,
  deadline?: number,
  boardType?: "perfboard" | "stripboard",
  config?: AdvancedConfig,
): { positions: Map<string, Position>; rotations: Map<string, Rotation>; cost: number } {
  const restarts = config?.hcRestarts ?? 10;
  const maxIter = config?.hcMaxIter ?? 100;
  const compactnessWeight = config?.compactnessWeight ?? 3;
  const beautyGroups = maybeBuildBeautyGroups(config?.beautyFilter, parts, footprintInfoMap);

  const evaluate = (positions: Map<string, Position>, rotations: Map<string, Rotation>): number =>
    evaluateFullRouting(positions, rotations, allKeys, fixedPositions, footprintInfoMap,
      parts, parsedKiCadDoc, routingCosts, maxJumpers, deadline, boardType, compactnessWeight, beautyGroups);

  function makeRandomStart(): { positions: Map<string, Position>; rotations: Map<string, Rotation> } {
    const positions = new Map<string, Position>();
    const rotations = new Map<string, Rotation>(initialRotations);
    const occupied = new Set<string>();
    for (const [key, pos] of fixedPositions) {
      const info = footprintInfoMap.get(key);
      if (!info) continue;
      const rot = rotations.get(key) ?? 0;
      const { w, h } = getRotatedDims(info, rot);
      for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) occupied.add(`${pos.x + dx},${pos.y + dy}`);
    }
    const shuffled = [...unplacedKeys].sort(() => Math.random() - 0.5);
    for (const key of shuffled) {
      const info = footprintInfoMap.get(key);
      if (!info) continue;
      const rot: Rotation = Math.floor(Math.random() * 4) as Rotation;
      rotations.set(key, rot);
      const { w, h } = getRotatedDims(info, rot);
      let placed = false;
      for (let attempt = 0; attempt < 80 && !placed; attempt++) {
        const x = Math.floor(Math.random() * Math.max(1, boardW - w));
        const y = Math.floor(Math.random() * Math.max(1, boardH - h));
        let blocked = false;
        for (let cy = 0; cy < h && !blocked; cy++)
          for (let cx = 0; cx < w && !blocked; cx++)
            if (occupied.has(`${x + cx},${y + cy}`)) blocked = true;
        if (!blocked) {
          positions.set(key, { x, y });
          for (let cy = 0; cy < h; cy++) for (let cx = 0; cx < w; cx++) occupied.add(`${x + cx},${y + cy}`);
          placed = true;
        }
      }
      if (!placed) positions.set(key, { x: 0, y: 0 });
    }
    return { positions, rotations };
  }

  let bestCost = Infinity;
  let bestPositions = new Map<string, Position>();
  let bestRotations = new Map<string, Rotation>(initialRotations);

  for (let r = 0; r < restarts; r++) {
    if (deadline && Date.now() > deadline) break;

    const start = makeRandomStart();
    let curPos = start.positions;
    let curRot = start.rotations;
    let curCost = evaluate(curPos, curRot);

    for (let iter = 0; iter < maxIter; iter++) {
      if (deadline && Date.now() > deadline) break;

      let improved = false;

      // Try moves for random subset of parts
      const tryKeys = [...unplacedKeys].sort(() => Math.random() - 0.5).slice(0, Math.min(unplacedKeys.length, 8));
      for (const key of tryKeys) {
        const info = footprintInfoMap.get(key);
        if (!info) continue;

        // Try shift moves
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
          const pos = curPos.get(key);
          if (!pos) continue;
          const rot = curRot.get(key) ?? 0;
          const { w, h } = getRotatedDims(info, rot);
          const nx = pos.x + dx, ny = pos.y + dy;
          if (nx < 0 || ny < 0 || nx + w > boardW || ny + h > boardH) continue;
          if (hasOverlap(nx, ny, w, h, new Map([...fixedPositions, ...curPos]), footprintInfoMap, curRot, key)) continue;
          const newPos = new Map(curPos);
          newPos.set(key, { x: nx, y: ny });
          const cost = evaluate(newPos, curRot);
          if (cost < curCost) {
            curPos = newPos; curCost = cost; improved = true; break;
          }
        }

        // Try rotate
        const newRot = new Map(curRot);
        const nextR = ((curRot.get(key) ?? 0) + 1) % 4 as Rotation;
        newRot.set(key, nextR);
        const pos = curPos.get(key);
        if (pos) {
          const { w, h } = getRotatedDims(info, nextR);
          if (pos.x + w <= boardW && pos.y + h <= boardH &&
              !hasOverlap(pos.x, pos.y, w, h, new Map([...fixedPositions, ...curPos]), footprintInfoMap, newRot, key)) {
            const cost = evaluate(curPos, newRot);
            if (cost < curCost) { curRot = newRot; curCost = cost; improved = true; }
          }
        }
      }

      if (!improved) break; // Local optimum reached
    }

    if (curCost < bestCost) {
      bestCost = curCost;
      bestPositions = curPos;
      bestRotations = curRot;
    }
  }

  return { positions: bestPositions, rotations: bestRotations, cost: bestCost };
}

// ─── Shared place-and-route evaluation ───
// Core scoring function: runs the real A* router on every candidate.
// All metaheuristic placerouters call this — no HPWL shortcuts.

function evaluateFullRouting(
  positions: Map<string, Position>,
  rotations: Map<string, Rotation>,
  allKeys: string[],
  fixedPositions: Map<string, Position>,
  footprintInfoMap: Map<string, FootprintInfo>,
  parts: Record<string, Part>,
  parsedKiCadDoc: any,
  routingCosts: RoutingCosts,
  maxJumpers: number | undefined,
  deadline: number | undefined,
  boardType: "perfboard" | "stripboard" | undefined,
  compactnessWeight: number,
  beautyGroups?: Map<string, string[]>,
): number {
  const allPos = new Map([...fixedPositions, ...positions]);

  // Heavily penalize unplaced parts (each missing part adds 500k to cost)
  // Use a large finite penalty rather than Infinity so algorithms can still compare
  // "2 parts missing" vs "1 part missing" and improve toward a complete solution
  let missingPenalty = 0;
  for (const key of allKeys) {
    if (footprintInfoMap.has(key) && !allPos.has(key)) missingPenalty += 500000;
  }

  // Reject overlapping placements — these are always invalid
  const posEntries = [...allPos.entries()];
  for (let i = 0; i < posEntries.length; i++) {
    const [k1, p1] = posEntries[i];
    const i1 = footprintInfoMap.get(k1);
    if (!i1) continue;
    const d1 = getRotatedDims(i1, rotations.get(k1) ?? 0);
    for (let j = i + 1; j < posEntries.length; j++) {
      const [k2, p2] = posEntries[j];
      const i2 = footprintInfoMap.get(k2);
      if (!i2) continue;
      const d2 = getRotatedDims(i2, rotations.get(k2) ?? 0);
      if (rectsOverlap(p1.x, p1.y, d1.w, d1.h, p2.x, p2.y, d2.w, d2.h, 0)) {
        return Infinity;
      }
    }
  }

  const placements = buildPlacementsFromPositions(allKeys, allPos, rotations, footprintInfoMap);
  let bCols = 0, bRows = 0;
  for (const p of placements) { bCols = Math.max(bCols, p.offsetX + p.width); bRows = Math.max(bRows, p.offsetY + p.height); }
  bCols += 2; bRows += 2;
  const routingNets = extractNets(placements, parts, parsedKiCadDoc);
  const result = routeNets(routingNets, placements, routingCosts, bCols, bRows, maxJumpers, true, deadline, boardType);
  const perimeterCost = 2 * (bCols + bRows) * (compactnessWeight * 2);
  let cost = missingPenalty + result.failedCount * 100000 + result.totalCost + (bCols * bRows) * compactnessWeight + perimeterCost;
  if (beautyGroups) {
    cost += computeBeautyCost(beautyGroups, allPos, rotations, footprintInfoMap);
  }
  return cost;
}

/** Convenience: build beauty groups if beautyFilter is enabled, else undefined */
function maybeBuildBeautyGroups(
  beautyFilter: boolean | undefined,
  parts: Record<string, Part>,
  footprintInfoMap: Map<string, FootprintInfo>,
): Map<string, string[]> | undefined {
  if (!beautyFilter) return undefined;
  const groups = buildPartTypeGroups(parts, footprintInfoMap);
  return groups.size > 0 ? groups : undefined;
}

function generateNeighborMove(
  currentPos: Map<string, Position>,
  currentRot: Map<string, Rotation>,
  unplacedKeys: string[],
  footprintInfoMap: Map<string, FootprintInfo>,
  fixedPositions: Map<string, Position>,
  boardW: number,
  boardH: number,
  rng: () => number,
): { newPos: Map<string, Position>; newRot: Map<string, Rotation> } | null {
  const key = unplacedKeys[Math.floor(rng() * unplacedKeys.length)];
  const info = footprintInfoMap.get(key);
  if (!info) return null;
  const newPos = new Map(currentPos);
  const newRot = new Map(currentRot);
  const r = rng();

  if (r < 0.5) {
    // Shift ±1-3
    const pos = newPos.get(key);
    if (!pos) return null;
    const rot = newRot.get(key) ?? 0;
    const { w, h } = getRotatedDims(info, rot);
    const dx = Math.floor(rng() * 7) - 3;
    const dy = Math.floor(rng() * 7) - 3;
    if (dx === 0 && dy === 0) return null;
    const nx = Math.max(0, Math.min(boardW - w, pos.x + dx));
    const ny = Math.max(0, Math.min(boardH - h, pos.y + dy));
    if (nx === pos.x && ny === pos.y) return null;
    if (hasOverlap(nx, ny, w, h, new Map([...fixedPositions, ...newPos]), footprintInfoMap, newRot, key)) return null;
    newPos.set(key, { x: nx, y: ny });
  } else if (r < 0.8) {
    // Rotate +1
    const oldRot = newRot.get(key) ?? 0;
    const nextR = ((oldRot + 1) % 4) as Rotation;
    newRot.set(key, nextR);
    const pos = newPos.get(key);
    if (pos) {
      const { w, h } = getRotatedDims(info, nextR);
      if (pos.x + w > boardW || pos.y + h > boardH) return null;
      if (hasOverlap(pos.x, pos.y, w, h, new Map([...fixedPositions, ...newPos]), footprintInfoMap, newRot, key)) return null;
    }
  } else {
    // Swap two parts
    const other = unplacedKeys[Math.floor(rng() * unplacedKeys.length)];
    if (other === key) return null;
    const p1 = newPos.get(key), p2 = newPos.get(other);
    if (!p1 || !p2) return null;
    const oi = footprintInfoMap.get(other);
    if (!oi) return null;
    const kr = newRot.get(key) ?? 0, or_ = newRot.get(other) ?? 0;
    const kd = getRotatedDims(info, kr), od = getRotatedDims(oi, or_);
    if (p2.x + kd.w > boardW || p2.y + kd.h > boardH || p1.x + od.w > boardW || p1.y + od.h > boardH) return null;
    newPos.set(key, { ...p2 });
    newPos.set(other, { ...p1 });
    // Check overlaps after swap (parts may have different sizes)
    const allPos = new Map([...fixedPositions, ...newPos]);
    if (hasOverlap(p2.x, p2.y, kd.w, kd.h, allPos, footprintInfoMap, newRot, key)) return null;
    if (hasOverlap(p1.x, p1.y, od.w, od.h, allPos, footprintInfoMap, newRot, other)) return null;
  }
  return { newPos, newRot };
}

function makeLcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; };
}

// ─── ILS (Iterated Local Search) ───

function ilsPlacement(
  unplacedKeys: string[],
  allKeys: string[],
  footprintInfoMap: Map<string, FootprintInfo>,
  fixedPositions: Map<string, Position>,
  initialRotations: Map<string, Rotation>,
  nets: PlacementNet[],
  parts: Record<string, Part>,
  parsedKiCadDoc: any,
  routingCosts: RoutingCosts,
  boardW: number,
  boardH: number,
  maxJumpers?: number,
  deadline?: number,
  boardType?: "perfboard" | "stripboard",
  config?: AdvancedConfig,
): { positions: Map<string, Position>; rotations: Map<string, Rotation>; cost: number } {
  const perturbStrength = config?.ilsPerturbStrength ?? 3;
  const maxIter = config?.ilsMaxIter ?? 100;
  const acceptWorse = config?.ilsAcceptWorse ?? 0.05;
  const compactnessWeight = config?.compactnessWeight ?? 3;

  const beautyGroups = maybeBuildBeautyGroups(config?.beautyFilter, parts, footprintInfoMap);
  const evaluate = (pos: Map<string, Position>, rot: Map<string, Rotation>) =>
    evaluateFullRouting(pos, rot, allKeys, fixedPositions, footprintInfoMap,
      parts, parsedKiCadDoc, routingCosts, maxJumpers, deadline, boardType, compactnessWeight, beautyGroups);

  // Seed from greedy (capped at 20% of time budget)
  const seedDeadline = deadline ? Math.min(deadline, Date.now() + Math.max(2000, Math.floor((deadline - Date.now()) * 0.2))) : undefined;
  const seed = integratedPlacement(unplacedKeys, allKeys, footprintInfoMap,
    fixedPositions, initialRotations, nets, parts, parsedKiCadDoc,
    routingCosts, boardW, boardH, maxJumpers, seedDeadline, 42,
    undefined, boardType, config);

  let currentPos = new Map(seed.positions);
  let currentRot = new Map(seed.rotations);
  let currentCost = evaluate(currentPos, currentRot);
  let bestPos = new Map(currentPos);
  let bestRot = new Map(currentRot);
  let bestCost = currentCost;

  const rng = makeLcg(67890);

  for (let iter = 0; iter < maxIter; iter++) {
    if (deadline && Date.now() > deadline) break;

    // Perturbation: displace random parts to new valid positions
    const pertPos = new Map(currentPos);
    const pertRot = new Map(currentRot);
    const keysToPerturb = [...unplacedKeys].sort(() => rng() - 0.5).slice(0, perturbStrength);
    for (const key of keysToPerturb) {
      const info = footprintInfoMap.get(key);
      if (!info) continue;
      if (rng() < 0.3) pertRot.set(key, Math.floor(rng() * 4) as Rotation);
      const rot = pertRot.get(key) ?? 0;
      const { w, h } = getRotatedDims(info, rot);
      for (let attempt = 0; attempt < 50; attempt++) {
        const x = Math.floor(rng() * Math.max(1, boardW - w));
        const y = Math.floor(rng() * Math.max(1, boardH - h));
        if (!hasOverlap(x, y, w, h, new Map([...fixedPositions, ...pertPos]), footprintInfoMap, pertRot, key)) {
          pertPos.set(key, { x, y });
          break;
        }
      }
    }

    // Local search (first-improvement hill climbing)
    let lsPos = pertPos;
    let lsRot = pertRot;
    let lsCost = evaluate(lsPos, lsRot);
    for (let ls = 0; ls < 30; ls++) {
      if (deadline && Date.now() > deadline) break;
      let improved = false;
      for (let attempt = 0; attempt < unplacedKeys.length * 2; attempt++) {
        const move = generateNeighborMove(lsPos, lsRot, unplacedKeys, footprintInfoMap, fixedPositions, boardW, boardH, rng);
        if (!move) continue;
        const cost = evaluate(move.newPos, move.newRot);
        if (cost < lsCost) {
          lsPos = move.newPos; lsRot = move.newRot; lsCost = cost;
          improved = true;
          break;
        }
      }
      if (!improved) break;
    }

    // Acceptance
    if (lsCost < currentCost || rng() < acceptWorse) {
      currentPos = lsPos; currentRot = lsRot; currentCost = lsCost;
    }
    if (lsCost < bestCost) {
      bestPos = new Map(lsPos); bestRot = new Map(lsRot); bestCost = lsCost;
    }
  }

  return { positions: bestPos, rotations: bestRot, cost: bestCost };
}

// ─── LAHC (Late Acceptance Hill Climbing) ───

function lahcPlacement(
  unplacedKeys: string[],
  allKeys: string[],
  footprintInfoMap: Map<string, FootprintInfo>,
  fixedPositions: Map<string, Position>,
  initialRotations: Map<string, Rotation>,
  nets: PlacementNet[],
  parts: Record<string, Part>,
  parsedKiCadDoc: any,
  routingCosts: RoutingCosts,
  boardW: number,
  boardH: number,
  maxJumpers?: number,
  deadline?: number,
  boardType?: "perfboard" | "stripboard",
  config?: AdvancedConfig,
): { positions: Map<string, Position>; rotations: Map<string, Rotation>; cost: number } {
  const L = config?.lahcHistoryLength ?? 50;
  const maxIter = config?.lahcMaxIter ?? 200;
  const compactnessWeight = config?.compactnessWeight ?? 3;

  const beautyGroups = maybeBuildBeautyGroups(config?.beautyFilter, parts, footprintInfoMap);
  const evaluate = (pos: Map<string, Position>, rot: Map<string, Rotation>) =>
    evaluateFullRouting(pos, rot, allKeys, fixedPositions, footprintInfoMap,
      parts, parsedKiCadDoc, routingCosts, maxJumpers, deadline, boardType, compactnessWeight, beautyGroups);

  // Seed from greedy
  const seedDeadline = deadline ? Math.min(deadline, Date.now() + Math.max(2000, Math.floor((deadline - Date.now()) * 0.2))) : undefined;
  const seed = integratedPlacement(unplacedKeys, allKeys, footprintInfoMap,
    fixedPositions, initialRotations, nets, parts, parsedKiCadDoc,
    routingCosts, boardW, boardH, maxJumpers, seedDeadline, 42,
    undefined, boardType, config);

  let currentPos = new Map(seed.positions);
  let currentRot = new Map(seed.rotations);
  let currentCost = evaluate(currentPos, currentRot);
  let bestPos = new Map(currentPos);
  let bestRot = new Map(currentRot);
  let bestCost = currentCost;

  const history = new Array<number>(L).fill(currentCost);
  const rng = makeLcg(11111);

  for (let iter = 0; iter < maxIter; iter++) {
    if (deadline && Date.now() > deadline) break;

    const move = generateNeighborMove(currentPos, currentRot, unplacedKeys,
      footprintInfoMap, fixedPositions, boardW, boardH, rng);
    if (!move) continue;

    const newCost = evaluate(move.newPos, move.newRot);
    const histIdx = iter % L;

    // Accept if better than current OR better than L steps ago
    if (newCost < currentCost || newCost <= history[histIdx]) {
      currentPos = move.newPos;
      currentRot = move.newRot;
      currentCost = newCost;
    }

    history[histIdx] = currentCost;

    if (currentCost < bestCost) {
      bestPos = new Map(currentPos);
      bestRot = new Map(currentRot);
      bestCost = currentCost;
    }
  }

  return { positions: bestPos, rotations: bestRot, cost: bestCost };
}

// ─── GRASP (Greedy Randomized Adaptive Search) ───

function graspPlacement(
  unplacedKeys: string[],
  allKeys: string[],
  footprintInfoMap: Map<string, FootprintInfo>,
  fixedPositions: Map<string, Position>,
  initialRotations: Map<string, Rotation>,
  nets: PlacementNet[],
  parts: Record<string, Part>,
  parsedKiCadDoc: any,
  routingCosts: RoutingCosts,
  boardW: number,
  boardH: number,
  maxJumpers?: number,
  deadline?: number,
  boardType?: "perfboard" | "stripboard",
  config?: AdvancedConfig,
): { positions: Map<string, Position>; rotations: Map<string, Rotation>; cost: number } {
  const restarts = config?.graspRestarts ?? 8;
  const lsIter = config?.graspLsIter ?? 50;
  const compactnessWeight = config?.compactnessWeight ?? 3;

  const beautyGroups = maybeBuildBeautyGroups(config?.beautyFilter, parts, footprintInfoMap);
  const evaluate = (pos: Map<string, Position>, rot: Map<string, Rotation>) =>
    evaluateFullRouting(pos, rot, allKeys, fixedPositions, footprintInfoMap,
      parts, parsedKiCadDoc, routingCosts, maxJumpers, deadline, boardType, compactnessWeight, beautyGroups);

  let bestPos = new Map<string, Position>();
  let bestRot = new Map<string, Rotation>(initialRotations);
  let bestCost = Infinity;

  const rng = makeLcg(99999);
  const strategies = ["largest-first", "most-connected", "random"] as const;

  for (let r = 0; r < restarts; r++) {
    if (deadline && Date.now() > deadline) break;

    // Randomized greedy construction with perturbed config
    const timeRemaining = deadline ? deadline - Date.now() : Infinity;
    const restartBudget = deadline ? Math.max(2000, Math.floor(timeRemaining / Math.max(1, restarts - r))) : undefined;
    const restartDeadline = restartBudget ? Date.now() + restartBudget : undefined;

    const perturbedConfig: AdvancedConfig = {
      ...config,
      partOrderStrategy: strategies[Math.floor(rng() * 3)],
      compactnessWeight: compactnessWeight * (0.5 + rng()),
      candidateListSize: Math.max(5, Math.floor((config?.candidateListSize ?? 20) * (0.5 + rng()))),
    };

    let constructed: { positions: Map<string, Position>; rotations: Map<string, Rotation>; cost: number };
    try {
      constructed = integratedPlacement(unplacedKeys, allKeys, footprintInfoMap,
        fixedPositions, initialRotations, nets, parts, parsedKiCadDoc,
        routingCosts, boardW, boardH, maxJumpers, restartDeadline, r + 1,
        undefined, boardType, perturbedConfig);
    } catch { continue; }

    // Local search
    let lsPos = new Map(constructed.positions);
    let lsRot = new Map(constructed.rotations);
    let lsCost = evaluate(lsPos, lsRot);

    for (let ls = 0; ls < lsIter; ls++) {
      if (deadline && Date.now() > deadline) break;
      const move = generateNeighborMove(lsPos, lsRot, unplacedKeys,
        footprintInfoMap, fixedPositions, boardW, boardH, rng);
      if (!move) continue;
      const cost = evaluate(move.newPos, move.newRot);
      if (cost < lsCost) {
        lsPos = move.newPos; lsRot = move.newRot; lsCost = cost;
      }
    }

    if (lsCost < bestCost) {
      bestPos = lsPos; bestRot = lsRot; bestCost = lsCost;
    }
  }

  if (bestCost === Infinity) {
    const fallback = integratedPlacement(unplacedKeys, allKeys, footprintInfoMap,
      fixedPositions, initialRotations, nets, parts, parsedKiCadDoc,
      routingCosts, boardW, boardH, maxJumpers, deadline, 42,
      undefined, boardType, config);
    return fallback;
  }

  return { positions: bestPos, rotations: bestRot, cost: bestCost };
}

// ─── Memetic Algorithm (GA + Local Search) ───

function memeticPlacement(
  unplacedKeys: string[],
  allKeys: string[],
  footprintInfoMap: Map<string, FootprintInfo>,
  fixedPositions: Map<string, Position>,
  initialRotations: Map<string, Rotation>,
  nets: PlacementNet[],
  parts: Record<string, Part>,
  parsedKiCadDoc: any,
  routingCosts: RoutingCosts,
  boardW: number,
  boardH: number,
  maxJumpers?: number,
  deadline?: number,
  boardType?: "perfboard" | "stripboard",
  config?: AdvancedConfig,
): { positions: Map<string, Position>; rotations: Map<string, Rotation>; cost: number } {
  const popSize = config?.memeticPopSize ?? 12;
  const generations = config?.memeticGenerations ?? 20;
  const crossoverRate = config?.memeticCrossoverRate ?? 0.7;
  const mutationRate = config?.memeticMutationRate ?? 0.3;
  const lsIter = config?.memeticLsIter ?? 15;
  const compactnessWeight = config?.compactnessWeight ?? 3;

  type Individual = { positions: Map<string, Position>; rotations: Map<string, Rotation>; cost: number };

  const beautyGroups = maybeBuildBeautyGroups(config?.beautyFilter, parts, footprintInfoMap);
  const evaluate = (pos: Map<string, Position>, rot: Map<string, Rotation>) =>
    evaluateFullRouting(pos, rot, allKeys, fixedPositions, footprintInfoMap,
      parts, parsedKiCadDoc, routingCosts, maxJumpers, deadline, boardType, compactnessWeight, beautyGroups);

  function evaluateIndividual(positions: Map<string, Position>, rotations: Map<string, Rotation>): number {
    const missingCount = unplacedKeys.filter(k => !positions.has(k)).length;
    if (missingCount > 0) return missingCount * 1000000;
    return evaluate(positions, rotations);
  }

  const rng = makeLcg(55555);

  function makeRandomIndividual(): Individual {
    const positions = new Map<string, Position>();
    const rotations = new Map<string, Rotation>(initialRotations);
    const occupied = new Set<string>();
    for (const [key, pos] of fixedPositions) {
      const info = footprintInfoMap.get(key);
      if (!info) continue;
      const rot = rotations.get(key) ?? 0;
      const { w, h } = getRotatedDims(info, rot);
      for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) occupied.add(`${pos.x + dx},${pos.y + dy}`);
    }
    for (const key of unplacedKeys) {
      const info = footprintInfoMap.get(key);
      if (!info) continue;
      const rot = Math.floor(rng() * 4) as Rotation;
      rotations.set(key, rot);
      const { w, h } = getRotatedDims(info, rot);
      let placed = false;
      for (let attempt = 0; attempt < 80 && !placed; attempt++) {
        const x = Math.floor(rng() * Math.max(1, boardW - w));
        const y = Math.floor(rng() * Math.max(1, boardH - h));
        let blocked = false;
        for (let cy = 0; cy < h && !blocked; cy++)
          for (let cx = 0; cx < w && !blocked; cx++)
            if (occupied.has(`${x + cx},${y + cy}`)) blocked = true;
        if (!blocked) {
          positions.set(key, { x, y });
          for (let cy = 0; cy < h; cy++) for (let cx = 0; cx < w; cx++) occupied.add(`${x + cx},${y + cy}`);
          placed = true;
        }
      }
      if (!placed) positions.set(key, { x: 0, y: 0 });
    }
    return { positions, rotations, cost: evaluateIndividual(positions, rotations) };
  }

  function localSearchImprove(ind: Individual): Individual {
    let curPos = new Map(ind.positions);
    let curRot = new Map(ind.rotations);
    let curCost = ind.cost;
    for (let i = 0; i < lsIter; i++) {
      if (deadline && Date.now() > deadline) break;
      const move = generateNeighborMove(curPos, curRot, unplacedKeys,
        footprintInfoMap, fixedPositions, boardW, boardH, rng);
      if (!move) continue;
      const cost = evaluate(move.newPos, move.newRot);
      if (cost < curCost) {
        curPos = move.newPos; curRot = move.newRot; curCost = cost;
      }
    }
    return { positions: curPos, rotations: curRot, cost: curCost };
  }

  // Initialize population: 1 greedy seed + rest random
  const population: Individual[] = [];
  const seedDeadline = deadline ? Math.min(deadline, Date.now() + Math.max(2000, Math.floor((deadline - Date.now()) * 0.15))) : undefined;
  try {
    const greedy = integratedPlacement(unplacedKeys, allKeys, footprintInfoMap,
      fixedPositions, initialRotations, nets, parts, parsedKiCadDoc,
      routingCosts, boardW, boardH, maxJumpers, seedDeadline, 0,
      undefined, boardType, config);
    const cost = evaluateIndividual(greedy.positions, greedy.rotations);
    population.push({ positions: greedy.positions, rotations: greedy.rotations, cost });
  } catch { population.push(makeRandomIndividual()); }
  while (population.length < popSize) population.push(makeRandomIndividual());

  let bestEver = population.reduce((a, b) => a.cost < b.cost ? a : b);

  for (let gen = 0; gen < generations; gen++) {
    if (deadline && Date.now() > deadline) break;

    population.sort((a, b) => a.cost - b.cost);
    const newPop: Individual[] = [population[0], population[1]]; // elitism

    while (newPop.length < popSize) {
      if (deadline && Date.now() > deadline) break;

      // Tournament selection
      const tournament = (n: number) => {
        let best = population[Math.floor(rng() * population.length)];
        for (let i = 1; i < n; i++) {
          const c = population[Math.floor(rng() * population.length)];
          if (c.cost < best.cost) best = c;
        }
        return best;
      };
      const parentA = tournament(3);
      const parentB = tournament(3);

      // Crossover + mutation
      const childPos = new Map<string, Position>();
      const childRot = new Map<string, Rotation>(initialRotations);
      for (const key of unplacedKeys) {
        if (rng() < crossoverRate) {
          const p = parentA.positions.get(key) ?? parentB.positions.get(key);
          if (p) childPos.set(key, { ...p });
          childRot.set(key, parentA.rotations.get(key) ?? 0);
        } else {
          const p = parentB.positions.get(key) ?? parentA.positions.get(key);
          if (p) childPos.set(key, { ...p });
          childRot.set(key, parentB.rotations.get(key) ?? 0);
        }
        // Mutation
        if (rng() < mutationRate) {
          const info = footprintInfoMap.get(key);
          if (info) {
            if (rng() < 0.7) {
              const pos = childPos.get(key);
              if (pos) {
                const rot = childRot.get(key) ?? 0;
                const { w, h } = getRotatedDims(info, rot);
                const dx = Math.floor(rng() * 7) - 3;
                const dy = Math.floor(rng() * 7) - 3;
                childPos.set(key, {
                  x: Math.max(0, Math.min(boardW - w, pos.x + dx)),
                  y: Math.max(0, Math.min(boardH - h, pos.y + dy)),
                });
              }
            } else {
              childRot.set(key, Math.floor(rng() * 4) as Rotation);
            }
          }
        }
      }

      // Legalize overlaps
      const occupied = new Set<string>();
      for (const [key, pos] of fixedPositions) {
        const info = footprintInfoMap.get(key);
        if (!info) continue;
        const rot = childRot.get(key) ?? 0;
        const { w, h } = getRotatedDims(info, rot);
        for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) occupied.add(`${pos.x + dx},${pos.y + dy}`);
      }
      for (const key of unplacedKeys) {
        const info = footprintInfoMap.get(key);
        if (!info) continue;
        const pos = childPos.get(key);
        if (!pos) continue;
        const rot = childRot.get(key) ?? 0;
        const { w, h } = getRotatedDims(info, rot);
        let blocked = false;
        for (let cy = 0; cy < h && !blocked; cy++)
          for (let cx = 0; cx < w && !blocked; cx++)
            if (occupied.has(`${pos.x + cx},${pos.y + cy}`)) blocked = true;
        if (blocked) {
          let placed = false;
          for (let radius = 1; radius < boardW + boardH && !placed; radius++) {
            for (let dy = -radius; dy <= radius && !placed; dy++) {
              for (let dx = -radius; dx <= radius && !placed; dx++) {
                if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
                const x = pos.x + dx, y = pos.y + dy;
                if (x < 0 || y < 0 || x + w > boardW || y + h > boardH) continue;
                let ok = true;
                for (let cy = 0; cy < h && ok; cy++)
                  for (let cx = 0; cx < w && ok; cx++)
                    if (occupied.has(`${x + cx},${y + cy}`)) ok = false;
                if (ok) {
                  childPos.set(key, { x, y });
                  placed = true;
                }
              }
            }
          }
          if (!placed) {
            const fx = Math.max(0, Math.min(pos.x, boardW - w));
            const fy = Math.max(0, Math.min(pos.y, boardH - h));
            childPos.set(key, { x: fx, y: fy });
          }
        }
        const finalPos = childPos.get(key)!;
        for (let cy = 0; cy < h; cy++) for (let cx = 0; cx < w; cx++) occupied.add(`${finalPos.x + cx},${finalPos.y + cy}`);
      }

      const childCost = evaluateIndividual(childPos, childRot);
      // Local search improvement — the key memetic addition
      const improved = localSearchImprove({ positions: childPos, rotations: childRot, cost: childCost });
      newPop.push(improved);

      if (improved.cost < bestEver.cost) bestEver = improved;
    }

    population.length = 0;
    population.push(...newPop);
  }

  return bestEver;
}

// ─── LNS (Large Neighborhood Search) ───

function lnsPlacement(
  unplacedKeys: string[],
  allKeys: string[],
  footprintInfoMap: Map<string, FootprintInfo>,
  fixedPositions: Map<string, Position>,
  initialRotations: Map<string, Rotation>,
  nets: PlacementNet[],
  parts: Record<string, Part>,
  parsedKiCadDoc: any,
  routingCosts: RoutingCosts,
  boardW: number,
  boardH: number,
  maxJumpers?: number,
  deadline?: number,
  boardType?: "perfboard" | "stripboard",
  config?: AdvancedConfig,
): { positions: Map<string, Position>; rotations: Map<string, Rotation>; cost: number } {
  // Defaults tuned via evolutionary benchmark — low destroy ratio + adaptive wins consistently
  const baseDestroyRatio = config?.lnsDestroyRatio ?? 0.20;
  const maxIter = config?.lnsMaxIter ?? 150;
  const adaptive = config?.lnsAdaptive ?? true;
  const compactnessWeight = config?.compactnessWeight ?? 10;

  const beautyGroups = maybeBuildBeautyGroups(config?.beautyFilter, parts, footprintInfoMap);
  const evaluate = (pos: Map<string, Position>, rot: Map<string, Rotation>) =>
    evaluateFullRouting(pos, rot, allKeys, fixedPositions, footprintInfoMap,
      parts, parsedKiCadDoc, routingCosts, maxJumpers, deadline, boardType, compactnessWeight, beautyGroups);

  // Seed from greedy
  const seedDeadline = deadline ? Math.min(deadline, Date.now() + Math.max(2000, Math.floor((deadline - Date.now()) * 0.2))) : undefined;
  const seed = integratedPlacement(unplacedKeys, allKeys, footprintInfoMap,
    fixedPositions, initialRotations, nets, parts, parsedKiCadDoc,
    routingCosts, boardW, boardH, maxJumpers, seedDeadline, 42,
    undefined, boardType, config);

  let currentPos = new Map(seed.positions);
  let currentRot = new Map(seed.rotations);
  let currentCost = evaluate(currentPos, currentRot);
  let bestPos = new Map(currentPos);
  let bestRot = new Map(currentRot);
  let bestCost = currentCost;

  const rng = makeLcg(24680);
  const connections = buildPartConnections(nets);
  let noImproveCount = 0;
  let destroyRatio = baseDestroyRatio;

  for (let iter = 0; iter < maxIter; iter++) {
    if (deadline && Date.now() > deadline) break;

    // Destroy: remove random subset of parts
    const numToDestroy = Math.max(1, Math.round(unplacedKeys.length * destroyRatio));
    const shuffled = [...unplacedKeys].sort(() => rng() - 0.5);
    const destroyedKeys = shuffled.slice(0, numToDestroy);

    const partialPos = new Map(currentPos);
    const partialRot = new Map(currentRot);
    for (const key of destroyedKeys) partialPos.delete(key);

    // Repair: re-place destroyed parts greedily (most-connected first)
    destroyedKeys.sort((a, b) => (connections.get(b)?.size ?? 0) - (connections.get(a)?.size ?? 0));

    const occupied = new Set<string>();
    for (const [key, pos] of fixedPositions) {
      const info = footprintInfoMap.get(key);
      if (!info) continue;
      const rot = partialRot.get(key) ?? 0;
      const { w, h } = getRotatedDims(info, rot);
      for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) occupied.add(`${pos.x + dx},${pos.y + dy}`);
    }
    for (const [key, pos] of partialPos) {
      const info = footprintInfoMap.get(key);
      if (!info) continue;
      const rot = partialRot.get(key) ?? 0;
      const { w, h } = getRotatedDims(info, rot);
      for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) occupied.add(`${pos.x + dx},${pos.y + dy}`);
    }

    for (const key of destroyedKeys) {
      const info = footprintInfoMap.get(key);
      if (!info) continue;
      // Try all 4 rotations, pick best HPWL position
      let bestPlacePos: Position | null = null;
      let bestPlaceRot: Rotation = 0;
      let bestWl = Infinity;

      for (let r = 0; r < 4; r++) {
        const rot = r as Rotation;
        const { w, h } = getRotatedDims(info, rot);
        // Try positions adjacent to placed parts + random
        const candidates: Position[] = [];
        for (const [pk, pp] of new Map([...fixedPositions, ...partialPos])) {
          const pi = footprintInfoMap.get(pk);
          if (!pi) continue;
          const pr = partialRot.get(pk) ?? 0;
          const pd = getRotatedDims(pi, pr);
          for (const [ddx, ddy] of [[pd.w, 0], [-w, 0], [0, pd.h], [0, -h]]) {
            const cx = pp.x + ddx, cy = pp.y + ddy;
            if (cx >= 0 && cy >= 0 && cx + w <= boardW && cy + h <= boardH) {
              let blocked = false;
              for (let oy = 0; oy < h && !blocked; oy++)
                for (let ox = 0; ox < w && !blocked; ox++)
                  if (occupied.has(`${cx + ox},${cy + oy}`)) blocked = true;
              if (!blocked) candidates.push({ x: cx, y: cy });
            }
          }
        }
        // Add random positions
        for (let i = 0; i < 5; i++) {
          const cx = Math.floor(rng() * Math.max(1, boardW - w));
          const cy = Math.floor(rng() * Math.max(1, boardH - h));
          let blocked = false;
          for (let oy = 0; oy < h && !blocked; oy++)
            for (let ox = 0; ox < w && !blocked; ox++)
              if (occupied.has(`${cx + ox},${cy + oy}`)) blocked = true;
          if (!blocked) candidates.push({ x: cx, y: cy });
        }

        for (const c of candidates) {
          partialPos.set(key, c);
          partialRot.set(key, rot);
          const wl = wireLength(key, c, nets, new Map([...fixedPositions, ...partialPos]), footprintInfoMap, partialRot);
          if (wl < bestWl) { bestWl = wl; bestPlacePos = c; bestPlaceRot = rot; }
        }
      }

      if (bestPlacePos) {
        partialPos.set(key, bestPlacePos);
        partialRot.set(key, bestPlaceRot);
        const { w, h } = getRotatedDims(info, bestPlaceRot);
        for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) occupied.add(`${bestPlacePos.x + dx},${bestPlacePos.y + dy}`);
      } else {
        // Fallback: scan for any valid spot
        const rot = partialRot.get(key) ?? 0;
        const { w, h } = getRotatedDims(info, rot);
        let placed = false;
        for (let y = 0; y + h <= boardH && !placed; y++) {
          for (let x = 0; x + w <= boardW && !placed; x++) {
            let blocked = false;
            for (let oy = 0; oy < h && !blocked; oy++)
              for (let ox = 0; ox < w && !blocked; ox++)
                if (occupied.has(`${x + ox},${y + oy}`)) blocked = true;
            if (!blocked) {
              partialPos.set(key, { x, y });
              for (let oy = 0; oy < h; oy++) for (let ox = 0; ox < w; ox++) occupied.add(`${x + ox},${y + oy}`);
              placed = true;
            }
          }
        }
        if (!placed) partialPos.set(key, { x: 0, y: 0 });
      }
    }

    const newCost = evaluate(partialPos, partialRot);

    if (newCost < currentCost) {
      currentPos = partialPos; currentRot = partialRot; currentCost = newCost;
      noImproveCount = 0;
      if (adaptive) destroyRatio = baseDestroyRatio;
    } else {
      noImproveCount++;
      if (adaptive && noImproveCount >= 5) {
        destroyRatio = Math.min(0.7, destroyRatio + 0.1);
        noImproveCount = 0;
      }
    }

    if (currentCost < bestCost) {
      bestPos = new Map(currentPos); bestRot = new Map(currentRot); bestCost = currentCost;
    }
  }

  return { positions: bestPos, rotations: bestRot, cost: bestCost };
}

// ─── VNS (Variable Neighborhood Search) ───

function vnsPlacement(
  unplacedKeys: string[],
  allKeys: string[],
  footprintInfoMap: Map<string, FootprintInfo>,
  fixedPositions: Map<string, Position>,
  initialRotations: Map<string, Rotation>,
  nets: PlacementNet[],
  parts: Record<string, Part>,
  parsedKiCadDoc: any,
  routingCosts: RoutingCosts,
  boardW: number,
  boardH: number,
  maxJumpers?: number,
  deadline?: number,
  boardType?: "perfboard" | "stripboard",
  config?: AdvancedConfig,
): { positions: Map<string, Position>; rotations: Map<string, Rotation>; cost: number } {
  const kMax = config?.vnsKmax ?? 5;
  const maxIter = config?.vnsMaxIter ?? 100;
  const compactnessWeight = config?.compactnessWeight ?? 3;
  const beautyGroups = maybeBuildBeautyGroups(config?.beautyFilter, parts, footprintInfoMap);
  const evaluate = (pos: Map<string, Position>, rot: Map<string, Rotation>) =>
    evaluateFullRouting(pos, rot, allKeys, fixedPositions, footprintInfoMap,
      parts, parsedKiCadDoc, routingCosts, maxJumpers, deadline, boardType, compactnessWeight, beautyGroups);

  const seedDeadline = deadline ? Math.min(deadline, Date.now() + Math.max(2000, Math.floor((deadline - Date.now()) * 0.2))) : undefined;
  const seed = integratedPlacement(unplacedKeys, allKeys, footprintInfoMap,
    fixedPositions, initialRotations, nets, parts, parsedKiCadDoc,
    routingCosts, boardW, boardH, maxJumpers, seedDeadline, 42,
    undefined, boardType, config);

  let bestPos = new Map(seed.positions);
  let bestRot = new Map(seed.rotations);
  let bestCost = evaluate(bestPos, bestRot);
  const rng = makeLcg(77777);

  for (let iter = 0; iter < maxIter; iter++) {
    if (deadline && Date.now() > deadline) break;
    let k = 1;
    while (k <= kMax) {
      if (deadline && Date.now() > deadline) break;
      // Shake: make k random moves
      let shakenPos = new Map(bestPos);
      let shakenRot = new Map(bestRot);
      for (let s = 0; s < k; s++) {
        const move = generateNeighborMove(shakenPos, shakenRot, unplacedKeys, footprintInfoMap, fixedPositions, boardW, boardH, rng);
        if (move) { shakenPos = move.newPos; shakenRot = move.newRot; }
      }
      // Local search: hill climb from shaken solution
      let currentPos = shakenPos;
      let currentRot = shakenRot;
      let currentCost = evaluate(currentPos, currentRot);
      for (let ls = 0; ls < 15; ls++) {
        const move = generateNeighborMove(currentPos, currentRot, unplacedKeys, footprintInfoMap, fixedPositions, boardW, boardH, rng);
        if (!move) continue;
        const cost = evaluate(move.newPos, move.newRot);
        if (cost < currentCost) { currentPos = move.newPos; currentRot = move.newRot; currentCost = cost; }
      }
      if (currentCost < bestCost) {
        bestPos = currentPos; bestRot = currentRot; bestCost = currentCost;
        k = 1; // Reset neighborhood
      } else {
        k++;
      }
    }
  }
  return { positions: bestPos, rotations: bestRot, cost: bestCost };
}

// ─── RRT (Record-to-Record Travel) ───

function rrtPlacement(
  unplacedKeys: string[],
  allKeys: string[],
  footprintInfoMap: Map<string, FootprintInfo>,
  fixedPositions: Map<string, Position>,
  initialRotations: Map<string, Rotation>,
  nets: PlacementNet[],
  parts: Record<string, Part>,
  parsedKiCadDoc: any,
  routingCosts: RoutingCosts,
  boardW: number,
  boardH: number,
  maxJumpers?: number,
  deadline?: number,
  boardType?: "perfboard" | "stripboard",
  config?: AdvancedConfig,
): { positions: Map<string, Position>; rotations: Map<string, Rotation>; cost: number } {
  const deviation = config?.rrtDeviation ?? 0.05;
  const maxIter = config?.rrtMaxIter ?? 200;
  const compactnessWeight = config?.compactnessWeight ?? 3;
  const beautyGroups = maybeBuildBeautyGroups(config?.beautyFilter, parts, footprintInfoMap);
  const evaluate = (pos: Map<string, Position>, rot: Map<string, Rotation>) =>
    evaluateFullRouting(pos, rot, allKeys, fixedPositions, footprintInfoMap,
      parts, parsedKiCadDoc, routingCosts, maxJumpers, deadline, boardType, compactnessWeight, beautyGroups);

  const seedDeadline = deadline ? Math.min(deadline, Date.now() + Math.max(2000, Math.floor((deadline - Date.now()) * 0.2))) : undefined;
  const seed = integratedPlacement(unplacedKeys, allKeys, footprintInfoMap,
    fixedPositions, initialRotations, nets, parts, parsedKiCadDoc,
    routingCosts, boardW, boardH, maxJumpers, seedDeadline, 42,
    undefined, boardType, config);

  let currentPos = new Map(seed.positions);
  let currentRot = new Map(seed.rotations);
  let currentCost = evaluate(currentPos, currentRot);
  let bestPos = new Map(currentPos);
  let bestRot = new Map(currentRot);
  let bestCost = currentCost;
  let record = currentCost;
  const rng = makeLcg(88888);

  for (let iter = 0; iter < maxIter; iter++) {
    if (deadline && Date.now() > deadline) break;
    const move = generateNeighborMove(currentPos, currentRot, unplacedKeys, footprintInfoMap, fixedPositions, boardW, boardH, rng);
    if (!move) continue;
    const newCost = evaluate(move.newPos, move.newRot);
    // Accept if within deviation of record
    if (newCost < record + record * deviation) {
      currentPos = move.newPos; currentRot = move.newRot; currentCost = newCost;
      if (currentCost < record) record = currentCost;
      if (currentCost < bestCost) { bestPos = new Map(currentPos); bestRot = new Map(currentRot); bestCost = currentCost; }
    }
  }
  return { positions: bestPos, rotations: bestRot, cost: bestCost };
}

// ─── Scatter Search ───

function scatterPlacement(
  unplacedKeys: string[],
  allKeys: string[],
  footprintInfoMap: Map<string, FootprintInfo>,
  fixedPositions: Map<string, Position>,
  initialRotations: Map<string, Rotation>,
  nets: PlacementNet[],
  parts: Record<string, Part>,
  parsedKiCadDoc: any,
  routingCosts: RoutingCosts,
  boardW: number,
  boardH: number,
  maxJumpers?: number,
  deadline?: number,
  boardType?: "perfboard" | "stripboard",
  config?: AdvancedConfig,
): { positions: Map<string, Position>; rotations: Map<string, Rotation>; cost: number } {
  const refSize = config?.scatterRefSize ?? 10;
  const maxIter = config?.scatterMaxIter ?? 30;
  const compactnessWeight = config?.compactnessWeight ?? 3;
  const beautyGroups = maybeBuildBeautyGroups(config?.beautyFilter, parts, footprintInfoMap);
  const evaluate = (pos: Map<string, Position>, rot: Map<string, Rotation>) =>
    evaluateFullRouting(pos, rot, allKeys, fixedPositions, footprintInfoMap,
      parts, parsedKiCadDoc, routingCosts, maxJumpers, deadline, boardType, compactnessWeight, beautyGroups);

  type Solution = { pos: Map<string, Position>; rot: Map<string, Rotation>; cost: number };

  // Generate diverse initial population via greedy with different seeds
  const population: Solution[] = [];
  for (let s = 0; s < refSize * 2; s++) {
    if (deadline && Date.now() > deadline) break;
    const seedDeadline = deadline ? Math.min(deadline, Date.now() + Math.max(500, Math.floor((deadline - Date.now()) * 0.05))) : undefined;
    const result = integratedPlacement(unplacedKeys, allKeys, footprintInfoMap,
      fixedPositions, initialRotations, nets, parts, parsedKiCadDoc,
      routingCosts, boardW, boardH, maxJumpers, seedDeadline, s * 37 + 1,
      undefined, boardType, config);
    const cost = evaluate(result.positions, result.rotations);
    population.push({ pos: result.positions, rot: result.rotations, cost });
  }
  population.sort((a, b) => a.cost - b.cost);

  // Reference set: best half
  let refSet = population.slice(0, refSize);
  let bestSol = refSet[0];
  const rng = makeLcg(99999);

  for (let iter = 0; iter < maxIter; iter++) {
    if (deadline && Date.now() > deadline) break;
    const newSolutions: Solution[] = [];

    // Combine pairs from reference set
    for (let i = 0; i < refSet.length && i < 4; i++) {
      for (let j = i + 1; j < refSet.length && j < 6; j++) {
        if (deadline && Date.now() > deadline) break;
        // Combination: for each part, pick position from parent with better routing
        const childPos = new Map<string, Position>();
        const childRot = new Map<string, Rotation>();
        for (const key of unplacedKeys) {
          if (rng() < 0.5) {
            const p = refSet[i].pos.get(key);
            if (p) childPos.set(key, { ...p });
            childRot.set(key, refSet[i].rot.get(key) ?? 0);
          } else {
            const p = refSet[j].pos.get(key);
            if (p) childPos.set(key, { ...p });
            childRot.set(key, refSet[j].rot.get(key) ?? 0);
          }
        }
        // Fix overlaps by nudging
        for (const key of unplacedKeys) {
          const pos = childPos.get(key);
          if (!pos) continue;
          const info = footprintInfoMap.get(key);
          if (!info) continue;
          const rot = childRot.get(key) ?? 0;
          const { w, h } = getRotatedDims(info, rot);
          if (hasOverlap(pos.x, pos.y, w, h, new Map([...fixedPositions, ...childPos]), footprintInfoMap, childRot, key)) {
            // Try nearby positions
            let fixed = false;
            for (let dy = -2; dy <= 2 && !fixed; dy++) {
              for (let dx = -2; dx <= 2 && !fixed; dx++) {
                const nx = Math.max(0, Math.min(boardW - w, pos.x + dx));
                const ny = Math.max(0, Math.min(boardH - h, pos.y + dy));
                if (!hasOverlap(nx, ny, w, h, new Map([...fixedPositions, ...childPos]), footprintInfoMap, childRot, key)) {
                  childPos.set(key, { x: nx, y: ny });
                  fixed = true;
                }
              }
            }
          }
        }
        // Local search improvement
        let cPos = childPos, cRot = childRot;
        let cCost = evaluate(cPos, cRot);
        for (let ls = 0; ls < 10; ls++) {
          const move = generateNeighborMove(cPos, cRot, unplacedKeys, footprintInfoMap, fixedPositions, boardW, boardH, rng);
          if (!move) continue;
          const cost = evaluate(move.newPos, move.newRot);
          if (cost < cCost) { cPos = move.newPos; cRot = move.newRot; cCost = cost; }
        }
        newSolutions.push({ pos: cPos, rot: cRot, cost: cCost });
      }
    }

    // Update reference set
    const combined = [...refSet, ...newSolutions];
    combined.sort((a, b) => a.cost - b.cost);
    refSet = combined.slice(0, refSize);
    if (refSet[0].cost < bestSol.cost) bestSol = refSet[0];
  }
  return { positions: bestSol.pos, rotations: bestSol.rot, cost: bestSol.cost };
}

// ─── BLS (Breakout Local Search) ───

function blsPlacement(
  unplacedKeys: string[],
  allKeys: string[],
  footprintInfoMap: Map<string, FootprintInfo>,
  fixedPositions: Map<string, Position>,
  initialRotations: Map<string, Rotation>,
  nets: PlacementNet[],
  parts: Record<string, Part>,
  parsedKiCadDoc: any,
  routingCosts: RoutingCosts,
  boardW: number,
  boardH: number,
  maxJumpers?: number,
  deadline?: number,
  boardType?: "perfboard" | "stripboard",
  config?: AdvancedConfig,
): { positions: Map<string, Position>; rotations: Map<string, Rotation>; cost: number } {
  const penaltyWeight = config?.blsPenaltyWeight ?? 50;
  const maxIter = config?.blsMaxIter ?? 200;
  const compactnessWeight = config?.compactnessWeight ?? 3;
  const beautyGroups = maybeBuildBeautyGroups(config?.beautyFilter, parts, footprintInfoMap);
  const evaluate = (pos: Map<string, Position>, rot: Map<string, Rotation>) =>
    evaluateFullRouting(pos, rot, allKeys, fixedPositions, footprintInfoMap,
      parts, parsedKiCadDoc, routingCosts, maxJumpers, deadline, boardType, compactnessWeight, beautyGroups);

  const seedDeadline = deadline ? Math.min(deadline, Date.now() + Math.max(2000, Math.floor((deadline - Date.now()) * 0.2))) : undefined;
  const seed = integratedPlacement(unplacedKeys, allKeys, footprintInfoMap,
    fixedPositions, initialRotations, nets, parts, parsedKiCadDoc,
    routingCosts, boardW, boardH, maxJumpers, seedDeadline, 42,
    undefined, boardType, config);

  let currentPos = new Map(seed.positions);
  let currentRot = new Map(seed.rotations);
  let currentCost = evaluate(currentPos, currentRot);
  let bestPos = new Map(currentPos);
  let bestRot = new Map(currentRot);
  let bestCost = currentCost;

  // Penalty map: track how often each part has been at each position
  const penalties = new Map<string, number>(); // "partKey:x,y" → count
  const rng = makeLcg(55555);

  const penalizedCost = (pos: Map<string, Position>, rot: Map<string, Rotation>, baseCost: number): number => {
    let penalty = 0;
    for (const [key, p] of pos) {
      const pKey = `${key}:${p.x},${p.y}`;
      penalty += (penalties.get(pKey) ?? 0) * penaltyWeight;
    }
    return baseCost + penalty;
  };

  for (let iter = 0; iter < maxIter; iter++) {
    if (deadline && Date.now() > deadline) break;

    // Record current positions in penalty map
    for (const [key, p] of currentPos) {
      const pKey = `${key}:${p.x},${p.y}`;
      penalties.set(pKey, (penalties.get(pKey) ?? 0) + 1);
    }

    // Try multiple neighbors, pick best by penalized cost
    let bestNeighborPos: Map<string, Position> | null = null;
    let bestNeighborRot: Map<string, Rotation> | null = null;
    let bestNeighborRealCost = Infinity;
    let bestNeighborPenCost = Infinity;

    const numTrials = Math.min(unplacedKeys.length * 2, 15);
    for (let t = 0; t < numTrials; t++) {
      const move = generateNeighborMove(currentPos, currentRot, unplacedKeys, footprintInfoMap, fixedPositions, boardW, boardH, rng);
      if (!move) continue;
      const realCost = evaluate(move.newPos, move.newRot);
      const penCost = penalizedCost(move.newPos, move.newRot, realCost);
      if (penCost < bestNeighborPenCost) {
        bestNeighborPos = move.newPos; bestNeighborRot = move.newRot;
        bestNeighborRealCost = realCost; bestNeighborPenCost = penCost;
      }
    }

    if (bestNeighborPos) {
      currentPos = bestNeighborPos; currentRot = bestNeighborRot!; currentCost = bestNeighborRealCost;
      if (currentCost < bestCost) {
        bestPos = new Map(currentPos); bestRot = new Map(currentRot); bestCost = currentCost;
      }
    }
  }
  return { positions: bestPos, rotations: bestRot, cost: bestCost };
}

// ─── Placerouter registry ───
// Each algorithm plugs in via PlaceRouterFn. The registry maps approach names
// to their implementation. To add a new algorithm: write it, register it here.

type MetaheuristicFn = (
  unplacedKeys: string[], allKeys: string[],
  footprintInfoMap: Map<string, FootprintInfo>,
  fixedPositions: Map<string, Position>,
  initialRotations: Map<string, Rotation>,
  nets: PlacementNet[],
  parts: Record<string, Part>, parsedKiCadDoc: any,
  routingCosts: RoutingCosts,
  boardW: number, boardH: number,
  maxJumpers?: number, deadline?: number,
  boardType?: "perfboard" | "stripboard",
  config?: AdvancedConfig,
) => PlaceRouterResult;

function wrapMetaheuristic(fn: MetaheuristicFn): PlaceRouterFn {
  return (ctx) => fn(
    ctx.unplacedKeys, ctx.allKeys, ctx.footprintInfoMap,
    ctx.fixedPositions, ctx.initialRotations, ctx.nets,
    ctx.parts, ctx.parsedKiCadDoc, ctx.routingCosts,
    ctx.boardW, ctx.boardH, ctx.maxJumpers, ctx.deadline,
    ctx.boardType, ctx.config,
  );
}

const PLACEROUTERS: Record<PlaceRouteApproach, PlaceRouterFn> = {
  "greedy-route": (ctx) => integratedPlacement(
    ctx.unplacedKeys, ctx.allKeys, ctx.footprintInfoMap,
    ctx.fixedPositions, ctx.initialRotations, ctx.nets,
    ctx.parts, ctx.parsedKiCadDoc, ctx.routingCosts,
    ctx.boardW, ctx.boardH, ctx.maxJumpers, ctx.deadline,
    undefined, ctx.flexVariantsMap, ctx.boardType, ctx.config,
  ),
  "sa":             wrapMetaheuristic(saPlacement),
  "ga":             wrapMetaheuristic(gaPlacement),
  "tabu":           wrapMetaheuristic(tabuPlacement),
  "hill-climbing":  wrapMetaheuristic(hillClimbPlacement),
  "ils":            wrapMetaheuristic(ilsPlacement),
  "lahc":           wrapMetaheuristic(lahcPlacement),
  "grasp":          wrapMetaheuristic(graspPlacement),
  "memetic":        wrapMetaheuristic(memeticPlacement),
  "lns":            wrapMetaheuristic(lnsPlacement),
  "vns":            wrapMetaheuristic(vnsPlacement),
  "rrt":            wrapMetaheuristic(rrtPlacement),
  "scatter":        wrapMetaheuristic(scatterPlacement),
  "bls":            wrapMetaheuristic(blsPlacement),
};

// ─── Main entry (integrated placerouter) ───
// Every approach runs actual A* routing during evaluation — no separate
// placement-then-route or HPWL-only pipelines.

export function computeSmartPlacements(input: PlacementInput): PlacementResult {
  const { parts, parsedKiCadDoc, manualPositions, getFootprintInfo } = input;
  // Merge top-level beautyFilter into advancedConfig so algorithms see it
  const advancedConfig: AdvancedConfig | undefined = input.beautyFilter
    ? { ...input.advancedConfig, beautyFilter: true }
    : input.advancedConfig;
  const userRotations = input.rotations ?? {};
  const approach = input.approach ?? "greedy-route";
  const routingCosts = input.routingCosts ?? { stepCost: 50, bendCost: 50, pinCost: 20500, routeCost: 20001 };
  const maxJumpers = input.maxJumpers;
  const boardType = input.boardType ?? "perfboard";
  const totalTimeoutMs = input.timeoutMs ?? 0;
  // ACO handles diversity internally — no retries needed
  const globalDeadline = totalTimeoutMs > 0 ? Date.now() + totalTimeoutMs : undefined;
  const minCols = input.minCols ?? 5;
  const minRows = input.minRows ?? 5;
  const maxCols = input.maxCols;
  const maxRows = input.maxRows;
  const maxSum = input.maxSum;

  const partsWithFootprints = Object.entries(parts).filter(([_, part]) => part.footprint != null);
  if (partsWithFootprints.length === 0) return { placements: [], boardCols: minCols, boardRows: minRows, rotations: {} };

  const footprintInfoMap = new Map<string, FootprintInfo>();
  const fixedPositions = new Map<string, Position>();
  const unplacedKeys: string[] = [];

  for (const [key, part] of partsWithFootprints) {
    const info = getFootprintInfo(part);
    if (!info) continue;
    footprintInfoMap.set(key, info);

    const manual = manualPositions[key];
    if (manual) {
      fixedPositions.set(key, { x: manual.x, y: manual.y });
    } else {
      unplacedKeys.push(key);
    }
  }

  // Build flex variants map for flexible resistors
  const flexVariantsMap = new Map<string, FlexVariant[]>();
  if (input.flexResistors) {
    for (const [key, part] of partsWithFootprints) {
      const info = footprintInfoMap.get(key);
      if (!info) continue;
      const variants = generateFlexVariants(info, part);
      if (variants.length > 0) flexVariantsMap.set(key, variants);
    }
  }

  const allKeys = [...unplacedKeys, ...fixedPositions.keys()];
  const nets = buildPlacementNets(parts, parsedKiCadDoc, footprintInfoMap, allKeys);

  const initialRotations = new Map<string, Rotation>();
  for (const key of allKeys) {
    initialRotations.set(key, userRotations[key] ?? 0);
  }

  const fixedPlacementsForSizing: PartPlacement[] = [];
  for (const [key, pos] of fixedPositions) {
    const info = footprintInfoMap.get(key)!;
    const rot = initialRotations.get(key) ?? 0;
    const { w, h } = getRotatedDims(info, rot);
    fixedPlacementsForSizing.push({ partKey: key, offsetX: pos.x, offsetY: pos.y, width: w, height: h, pins: [] });
  }

  const runForBounds = (mCols?: number, mRows?: number): PlacementResult & { score: number } => {
    let finalPositions: Map<string, Position>;
    let finalRotations: Map<string, Rotation>;
    let score = 0;

    if (unplacedKeys.length === 0) {
      finalPositions = fixedPositions;
      finalRotations = initialRotations;
    } else {
      const { boardW, boardH } = estimateBoardSize(footprintInfoMap, unplacedKeys, fixedPlacementsForSizing, minCols, minRows, mCols, mRows, boardType, advancedConfig?.areaMultiplier);
      const adjW = Math.min(boardW + 1, mCols ?? Infinity);
      const adjH = Math.min(boardH + 1, mRows ?? Infinity);

      const placerouter = PLACEROUTERS[approach] ?? PLACEROUTERS["greedy-route"];
      const result = placerouter({
        unplacedKeys, allKeys, footprintInfoMap, fixedPositions, initialRotations,
        nets, parts, parsedKiCadDoc, routingCosts,
        boardW: adjW, boardH: adjH,
        maxJumpers, deadline: globalDeadline, boardType, config: advancedConfig,
        flexVariantsMap: flexVariantsMap.size > 0 ? flexVariantsMap : undefined,
      });
      finalPositions = new Map([...fixedPositions, ...result.positions]);
      finalRotations = result.rotations;
      score = result.cost;
      for (const [key] of fixedPositions) finalRotations.set(key, initialRotations.get(key) ?? 0);

      // Recovery: force-place any missing parts by trying all rotations on an expanded board
      const missingKeys = allKeys.filter(k => footprintInfoMap.has(k) && !finalPositions.has(k));
      if (missingKeys.length > 0) {
        // Sort missing parts largest-first for best packing
        missingKeys.sort((a, b) => {
          const ai = footprintInfoMap.get(a)!, bi = footprintInfoMap.get(b)!;
          return (bi.w * bi.h) - (ai.w * ai.h);
        });
        // Compute current board extent from placed parts
        let curMaxX = 0, curMaxY = 0;
        for (const [k, p] of finalPositions) {
          const info = footprintInfoMap.get(k);
          if (!info) continue;
          const d = getRotatedDims(info, finalRotations.get(k) ?? 0);
          curMaxX = Math.max(curMaxX, p.x + d.w);
          curMaxY = Math.max(curMaxY, p.y + d.h);
        }
        for (const key of missingKeys) {
          const info = footprintInfoMap.get(key)!;
          let placed = false;
          // Try all 4 rotations, expanding the board if needed
          for (const tryRot of [0, 1, 2, 3] as Rotation[]) {
            const d = getRotatedDims(info, tryRot);
            // Try fitting within current board extent + 2
            let tryW = Math.max(curMaxX + d.w + 2, adjW);
            let tryH = Math.max(curMaxY + d.h + 2, adjH);
            // Respect user constraints: only expand the unconstrained axis
            if (mRows && mRows > 0) tryH = Math.min(tryH, mRows);
            if (mCols && mCols > 0) tryW = Math.min(tryW, mCols);
            finalRotations.set(key, tryRot);
            const pos = findBestPosition(key, d.w, d.h, finalPositions, footprintInfoMap, finalRotations, nets, tryW, tryH);
            if (pos) {
              finalPositions.set(key, pos);
              curMaxX = Math.max(curMaxX, pos.x + d.w);
              curMaxY = Math.max(curMaxY, pos.y + d.h);
              placed = true;
              break;
            }
          }
          if (!placed) finalRotations.set(key, initialRotations.get(key) ?? 0);
        }
      }
    }

    const placements: PartPlacement[] = [];
    for (const key of allKeys) {
      const pos = finalPositions.get(key);
      if (!pos) continue;
      const info = footprintInfoMap.get(key)!;
      const rot = finalRotations.get(key) ?? 0;
      const { w, h } = getRotatedDims(info, rot);
      placements.push({
        partKey: key,
        offsetX: pos.x,
        offsetY: pos.y,
        width: w,
        height: h,
        pins: info.pins.map((p) => {
          const rp = rotateLocalPin(p.x, p.y, info.w, info.h, rot);
          return { ...p, x: rp.x + pos.x, y: rp.y + pos.y };
        }),
      });
    }

    const rotRecord: Record<string, Rotation> = {};
    for (const [k, v] of finalRotations) rotRecord[k] = v;

    const allFixed = unplacedKeys.length === 0;
    const placementResult = normalizePlacements(placements, minCols, minRows, rotRecord, !allFixed);

    // Integrated final routing — full (non-quick) pass so placement+routing are one result
    const routingNets = extractNets(placementResult.placements, parts, parsedKiCadDoc);
    const routing = routeNets(
      routingNets, placementResult.placements, routingCosts,
      placementResult.boardCols, placementResult.boardRows,
      maxJumpers, undefined, globalDeadline, boardType,
    );
    return { ...placementResult, routing, score };
  };

  // Sum constraint: try all valid (W, H) splits
  if (maxSum && maxSum > 0 && unplacedKeys.length > 0) {
    let bestResult: (PlacementResult & { score: number }) | null = null;
    let minW = 3, minH = 3;
    for (const [_, info] of footprintInfoMap) {
      const smaller = Math.min(info.w, info.h) + 2;
      minW = Math.max(minW, smaller);
      minH = Math.max(minH, smaller);
    }
    for (const [key, pos] of fixedPositions) {
      const info = footprintInfoMap.get(key)!;
      const rot = initialRotations.get(key) ?? 0;
      const { w, h } = getRotatedDims(info, rot);
      minW = Math.max(minW, pos.x + w + 1);
      minH = Math.max(minH, pos.y + h + 1);
    }
    for (let w = minW; w <= maxSum - minH; w++) {
      if (globalDeadline && Date.now() > globalDeadline) break;
      const h = maxSum - w;
      const result = runForBounds(w, h);
      if (!bestResult || result.score < bestResult.score) {
        bestResult = result;
      }
    }
    return bestResult ?? runForBounds(maxCols, maxRows);
  }

  return runForBounds(maxCols, maxRows);
}
