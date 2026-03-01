import type { PinPosition } from "$lib/types";
import type { PartPlacement, RoutingCosts } from "./overviewPlacement";

export type RatsnestLine = {
  path: Array<{ x: number; y: number }>;
  netName: string;
  failed?: boolean;
  layer?: number; // 1 = main layer (default), 2 = jumper wire (back of board)
};

export type StripCut = { row: number; col: number };

export interface RoutingResult {
  lines: RatsnestLine[];
  totalCost: number;
  failedCount: number;
  bends: number;
  crossings: number;
  directConnections: number;
  stripCuts?: StripCut[];
}

// ─── Routing metrics ───

/** Count direction changes in a path (each corner = 1 bend) */
function countPathBends(path: Array<{ x: number; y: number }>): number {
  if (path.length < 3) return 0;
  let bends = 0;
  for (let i = 1; i < path.length - 1; i++) {
    const dx1 = path[i].x - path[i - 1].x;
    const dy1 = path[i].y - path[i - 1].y;
    const dx2 = path[i + 1].x - path[i].x;
    const dy2 = path[i + 1].y - path[i].y;
    if (dx1 !== dx2 || dy1 !== dy2) bends++;
  }
  return bends;
}

/** Compute routing metrics from a set of lines */
function computeRoutingMetrics(lines: RatsnestLine[]): { bends: number; crossings: number; directConnections: number } {
  let bends = 0;
  let directConnections = 0;

  for (const line of lines) {
    if (line.failed) continue;
    bends += countPathBends(line.path);
    // Direct connection: path is exactly 2 points (pin-to-pin) with Manhattan distance 1
    if (line.path.length === 2) {
      const dist = Math.abs(line.path[1].x - line.path[0].x) + Math.abs(line.path[1].y - line.path[0].y);
      if (dist <= 1) directConnections++;
    }
  }

  // Count crossings: find cells used by different nets that overlap
  // A crossing occurs when two different-net line segments pass through the same cell
  const cellNets = new Map<number, string>();
  let crossings = 0;
  for (const line of lines) {
    if (line.failed || !line.path || line.path.length < 2) continue;
    const layer = line.layer ?? 1;
    if (layer !== 1) continue; // jumpers don't cross on the board
    for (let i = 0; i < line.path.length - 1; i++) {
      const a = line.path[i], b = line.path[i + 1];
      const dx = Math.sign(b.x - a.x), dy = Math.sign(b.y - a.y);
      let cx = a.x, cy = a.y;
      // Walk each cell along this segment (excluding endpoint pins to avoid counting pin-sharing as crossing)
      const isFirstCell = i === 0;
      const isEndpoint = (px: number, py: number) =>
        (isFirstCell && px === a.x && py === a.y) ||
        (i === line.path.length - 2 && px === b.x && py === b.y);
      while (cx !== b.x || cy !== b.y) {
        if (!isEndpoint(cx, cy)) {
          const key = cy * 10000 + cx;
          const existing = cellNets.get(key);
          if (existing !== undefined && existing !== line.netName) {
            crossings++;
          }
          cellNets.set(key, line.netName);
        }
        cx += dx;
        cy += dy;
      }
    }
  }

  return { bends, crossings, directConnections };
}

// ─── Path expansion ───

// Axis bitmask: bit 0 = horizontal, bit 1 = vertical
const AXIS_H = 1;
const AXIS_V = 2;

export function expandPathCells(
  path: Array<{ x: number; y: number }>
): Array<{ x: number; y: number }> {
  return expandPathCellsWithAxis(path).map(({ x, y }) => ({ x, y }));
}

export function expandPathCellsWithAxis(
  path: Array<{ x: number; y: number }>
): Array<{ x: number; y: number; axis: number }> {
  if (path.length <= 1) return path.map(p => ({ ...p, axis: AXIS_H | AXIS_V }));
  const cells: Array<{ x: number; y: number; axis: number }> = [];
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const dx = Math.sign(b.x - a.x);
    const dy = Math.sign(b.y - a.y);
    const axis = dx !== 0 ? AXIS_H : AXIS_V;
    let cx = a.x,
      cy = a.y;
    while (cx !== b.x || cy !== b.y) {
      cells.push({ x: cx, y: cy, axis });
      cx += dx;
      cy += dy;
    }
  }
  // Last point gets the axis of the last segment
  const lastSeg = path.length >= 2 ? path[path.length - 2] : path[0];
  const lastPt = path[path.length - 1];
  const lastAxis = (lastPt.x !== lastSeg.x) ? AXIS_H : AXIS_V;
  cells.push({ x: lastPt.x, y: lastPt.y, axis: lastAxis });
  return cells;
}

// ─── Direction-aware A* ───

const NO_DIR = 4;
const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

// Binary min-heap for fast open set
class MinHeap {
  private data: Array<{ key: number; f: number }> = [];

  get size() {
    return this.data.length;
  }

  push(key: number, f: number) {
    this.data.push({ key, f });
    this._bubbleUp(this.data.length - 1);
  }

  pop(): number {
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this._sinkDown(0);
    }
    return top.key;
  }

  private _bubbleUp(i: number) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.data[i].f >= this.data[parent].f) break;
      [this.data[i], this.data[parent]] = [this.data[parent], this.data[i]];
      i = parent;
    }
  }

  private _sinkDown(i: number) {
    const n = this.data.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      if (l < n && this.data[l].f < this.data[smallest].f) smallest = l;
      if (r < n && this.data[r].f < this.data[smallest].f) smallest = r;
      if (smallest === i) break;
      [this.data[i], this.data[smallest]] = [this.data[smallest], this.data[i]];
      i = smallest;
    }
  }
}

/**
 * Fast A* pathfinding with direction-aware state for bend penalties.
 * State encoded as integer: y * boardCols * 5 + x * 5 + dir
 * Returns { path, cost } or null if no path found.
 */
export function aStarRoute(
  start: { x: number; y: number },
  end: { x: number; y: number },
  pinCells: Set<string>,
  routeCellDirs: Map<string, number>,
  boardCols: number,
  boardRows: number,
  costs: RoutingCosts
): { path: Array<{ x: number; y: number }>; cost: number } | null {
  if (start.x === end.x && start.y === end.y) return { path: [start], cost: 0 };

  const W = boardCols;
  const stateSize = boardCols * boardRows * 5;
  const gScore = new Float64Array(stateSize).fill(Infinity);
  const parent = new Int32Array(stateSize).fill(-1);
  const closed = new Uint8Array(stateSize);

  const encode = (x: number, y: number, d: number) => y * W * 5 + x * 5 + d;
  const startKey = encode(start.x, start.y, NO_DIR);
  const endX = end.x,
    endY = end.y;
  const startCell = `${start.x},${start.y}`;
  const endCell = `${endX},${endY}`;

  gScore[startKey] = 0;

  const heap = new MinHeap();
  heap.push(startKey, Math.abs(start.x - endX) + Math.abs(start.y - endY));

  let endKey = -1;
  let iterations = 0;

  while (heap.size > 0) {
    if (++iterations > 500_000) break;
    const ck = heap.pop();
    if (closed[ck]) continue;
    closed[ck] = 1;

    // Decode state
    const cDir = ck % 5;
    const cXY = (ck - cDir) / 5;
    const cX = cXY % W;
    const cY = (cXY - cX) / W;

    if (cX === endX && cY === endY) {
      endKey = ck;
      break;
    }

    const curG = gScore[ck];

    for (let d = 0; d < 4; d++) {
      const nx = cX + DIRS[d][0];
      const ny = cY + DIRS[d][1];
      if (nx < 0 || nx >= boardCols || ny < 0 || ny >= boardRows) continue;

      const nk = encode(nx, ny, d);
      if (closed[nk]) continue;

      let moveCost = costs.stepCost;
      const cellKey = `${nx},${ny}`;
      if (cellKey !== endCell && cellKey !== startCell) {
        if (pinCells.has(cellKey)) {
          if (costs.pinCost > 20000) continue;
          moveCost = costs.pinCost;
        } else {
          const existingDirs = routeCellDirs.get(cellKey);
          if (existingDirs !== undefined) {
            // d=0,1 → horizontal (AXIS_H=1), d=2,3 → vertical (AXIS_V=2)
            const myAxis = d < 2 ? AXIS_H : AXIS_V;
            if (existingDirs & myAxis) {
              // Same axis = parallel overlap → always forbidden
              continue;
            }
            // Perpendicular = crossing → penalized with routeCost
            if (costs.routeCost > 20000) continue;
            moveCost = costs.routeCost;
          }
        }
      }

      if (cDir !== NO_DIR && cDir !== d) moveCost += costs.bendCost;

      const tentG = curG + moveCost;
      if (tentG < gScore[nk]) {
        gScore[nk] = tentG;
        parent[nk] = ck;
        heap.push(nk, tentG + Math.abs(nx - endX) + Math.abs(ny - endY));
      }
    }
  }

  if (endKey < 0) return null;

  // Reconstruct path
  const path: Array<{ x: number; y: number }> = [];
  let key = endKey;
  while (key !== startKey) {
    const d = key % 5;
    const xy = (key - d) / 5;
    const x = xy % W;
    const y = (xy - x) / W;
    path.push({ x, y });
    key = parent[key];
  }
  path.push(start);
  path.reverse();

  // Simplify to bend points
  if (path.length <= 2) return { path, cost: gScore[endKey] };
  const simplified: Array<{ x: number; y: number }> = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const dx1 = path[i].x - path[i - 1].x;
    const dy1 = path[i].y - path[i - 1].y;
    const dx2 = path[i + 1].x - path[i].x;
    const dy2 = path[i + 1].y - path[i].y;
    if (dx1 !== dx2 || dy1 !== dy2) simplified.push(path[i]);
  }
  simplified.push(path[path.length - 1]);
  return { path: simplified, cost: gScore[endKey] };
}

// ─── Strip-aware A* for stripboard ───

/**
 * A* for stripboard routing. Horizontal movement along an uncut strip is free (cost 0).
 * Vertical movement (wires/jumpers) has normal step cost. Strip conflicts (different net
 * claiming the same row segment) are handled by pinCells-like blocking.
 *
 * stripRowNets: Map<"row,col" → netName> — which net "owns" each cell on a strip row.
 * Moving horizontally into a cell owned by a DIFFERENT net is forbidden.
 * Moving horizontally into an unowned cell or same-net cell is free.
 */
export function aStarRouteStrip(
  start: { x: number; y: number },
  end: { x: number; y: number },
  pinCells: Set<string>,
  routeCellDirs: Map<string, number>,
  boardCols: number,
  boardRows: number,
  costs: RoutingCosts,
  currentNetName: string,
  stripRowNets: Map<string, string>,
  cuts: Set<string>,
  segOwners: Map<string, string | null>,
): { path: Array<{ x: number; y: number }>; cost: number } | null {
  if (start.x === end.x && start.y === end.y) return { path: [start], cost: 0 };

  const W = boardCols;
  const stateSize = boardCols * boardRows * 5;
  const gScore = new Float64Array(stateSize).fill(Infinity);
  const parent = new Int32Array(stateSize).fill(-1);
  const closed = new Uint8Array(stateSize);

  const encode = (x: number, y: number, d: number) => y * W * 5 + x * 5 + d;
  const startKey = encode(start.x, start.y, NO_DIR);
  const endX = end.x, endY = end.y;
  const startCell = `${start.x},${start.y}`;
  const endCell = `${endX},${endY}`;

  gScore[startKey] = 0;
  const heap = new MinHeap();
  heap.push(startKey, Math.abs(start.x - endX) + Math.abs(start.y - endY));

  let endKey = -1;
  let iterations = 0;

  while (heap.size > 0) {
    if (++iterations > 500_000) break;
    const ck = heap.pop();
    if (closed[ck]) continue;
    closed[ck] = 1;

    const cDir = ck % 5;
    const cXY = (ck - cDir) / 5;
    const cX = cXY % W;
    const cY = (cXY - cX) / W;

    if (cX === endX && cY === endY) { endKey = ck; break; }

    const curG = gScore[ck];

    for (let d = 0; d < 4; d++) {
      const nx = cX + DIRS[d][0];
      const ny = cY + DIRS[d][1];
      if (nx < 0 || nx >= boardCols || ny < 0 || ny >= boardRows) continue;

      const nk = encode(nx, ny, d);
      if (closed[nk]) continue;

      const cellKey = `${nx},${ny}`;
      const isHorizontal = d < 2; // d=0,1 are horizontal

      // Check segment ownership — destination strip segment compatibility.
      // On a real stripboard, you CAN pass a vertical wire through any hole by
      // cutting the strip on both sides (isolation cuts). This is expensive but
      // physically valid. Horizontal movement along another net's strip is forbidden.
      const destSegOwner = (cellKey !== endCell && cellKey !== startCell)
        ? segOwners.get(cellKey) : null;
      const isAlienStrip = destSegOwner != null && destSegOwner !== currentNetName;

      if (isAlienStrip && isHorizontal) {
        continue; // Can't travel horizontally along another net's strip
      }

      let moveCost: number;
      if (isHorizontal && cY === ny) {
        // Horizontal movement — check for strip cut
        const minCol = Math.min(cX, nx);
        if (cuts.has(`${cY},${minCol}`)) {
          moveCost = costs.stepCost; // Cut present — requires wire
        } else {
          moveCost = 0; // Free strip connection
        }
      } else {
        // Vertical movement = wire (normal cost)
        moveCost = costs.stepCost;
      }

      // Isolation cut penalty: passing vertically through another net's strip
      // requires 2 physical cuts to isolate the hole. Small penalty (cuts are easy).
      if (isAlienStrip) {
        moveCost += costs.stepCost;
      }

      // Check pin/route conflicts for non-endpoint cells
      if (cellKey !== endCell && cellKey !== startCell) {
        if (pinCells.has(cellKey)) {
          if (costs.pinCost > 20000) continue;
          moveCost += costs.pinCost;
        } else {
          const existingDirs = routeCellDirs.get(cellKey);
          if (existingDirs !== undefined) {
            const myAxis = d < 2 ? AXIS_H : AXIS_V;
            if (existingDirs & myAxis) continue; // Parallel overlap forbidden
            if (costs.routeCost > 20000) continue;
            moveCost += costs.routeCost;
          }
        }
      }

      if (cDir !== NO_DIR && cDir !== d) moveCost += costs.bendCost;

      const tentG = curG + moveCost;
      if (tentG < gScore[nk]) {
        gScore[nk] = tentG;
        parent[nk] = ck;
        heap.push(nk, tentG + Math.abs(nx - endX) + Math.abs(ny - endY));
      }
    }
  }

  if (endKey < 0) return null;

  const path: Array<{ x: number; y: number }> = [];
  let key = endKey;
  while (key !== startKey) {
    const d = key % 5;
    const xy = (key - d) / 5;
    const x = xy % W;
    const y = (xy - x) / W;
    path.push({ x, y });
    key = parent[key];
  }
  path.push(start);
  path.reverse();

  if (path.length <= 2) return { path, cost: gScore[endKey] };
  const simplified: Array<{ x: number; y: number }> = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const dx1 = path[i].x - path[i - 1].x;
    const dy1 = path[i].y - path[i - 1].y;
    const dx2 = path[i + 1].x - path[i].x;
    const dy2 = path[i + 1].y - path[i].y;
    if (dx1 !== dx2 || dy1 !== dy2) simplified.push(path[i]);
  }
  simplified.push(path[path.length - 1]);
  return { path: simplified, cost: gScore[endKey] };
}

// ─── Net extraction ───

interface NetPin {
  partKey: string;
  pinNumber: string | number;
  x: number;
  y: number;
}

export interface NetGroup {
  netCode: number;
  netName: string;
  pins: NetPin[];
}

export function extractNets(
  placements: PartPlacement[],
  parts: Record<string, { pins?: Array<{ pinNumber: string | number; netCode?: number }>; [k: string]: any }>,
  parsedKiCadDoc: any
): NetGroup[] {
  // Build pin position map from placements
  const pinPositionMap = new Map<string, { x: number; y: number }>();
  for (const placement of placements) {
    for (const pin of placement.pins) {
      pinPositionMap.set(`${placement.partKey}:${pin.pinNumber}`, { x: pin.x, y: pin.y });
    }
  }

  // Group pins by netCode
  const netMap = new Map<number, NetPin[]>();
  for (const placement of placements) {
    const part = parts[placement.partKey];
    if (!part?.pins) continue;
    for (const partPin of part.pins) {
      if (!partPin.netCode) continue;
      const pos = pinPositionMap.get(`${placement.partKey}:${partPin.pinNumber}`);
      if (!pos) continue;
      if (!netMap.has(partPin.netCode)) netMap.set(partPin.netCode, []);
      netMap.get(partPin.netCode)!.push({
        partKey: placement.partKey,
        pinNumber: partPin.pinNumber,
        x: pos.x,
        y: pos.y,
      });
    }
  }

  const result: NetGroup[] = [];
  for (const [netCode, pins] of netMap) {
    const netName =
      parsedKiCadDoc?.nets?.find((n: any) => n.code === netCode)?.name || `Net${netCode}`;
    if (/^unconnected/i.test(netName)) continue;

    // Only keep nets that span multiple parts (skip single-part internal nets)
    const uniqueParts = new Set(pins.map(p => p.partKey));
    if (uniqueParts.size < 2) continue;
    // Keep all pins — MST routing will pick optimal connection points per part
    result.push({ netCode, netName, pins });
  }
  return result;
}

// ─── Full routing evaluation ───

const FAILED_ROUTE_PENALTY = 100_000;

export function computeFullRouting(
  placements: PartPlacement[],
  parts: Record<string, any>,
  parsedKiCadDoc: any,
  costs: RoutingCosts,
  boardCols: number,
  boardRows: number
): RoutingResult {
  const nets = extractNets(placements, parts, parsedKiCadDoc);
  return routeNets(nets, placements, costs, boardCols, boardRows);
}

interface FailedSegment { p1: { x: number; y: number }; p2: { x: number; y: number }; netName: string }

/**
 * Stripboard routing — uses strip-aware A* with auto-cut generation.
 * Tries multiple net orderings, picks the best, then generates cuts.
 */
function routeNetsStrip(
  nets: NetGroup[],
  placements: PartPlacement[],
  pinCells: Set<string>,
  costs: RoutingCosts,
  boardCols: number,
  boardRows: number,
  maxLayer2?: number,
  quick?: boolean,
  deadline?: number,
): RoutingResult {
  const fullMode = !quick;
  const phase1Limit = quick ? 5 : 500;
  const phase1Deadline = fullMode ? Date.now() + 8000 : deadline;
  const sortedNets = [...nets].sort((a, b) => b.pins.length - a.pins.length);
  // Also try ordering by fewest pins first (small nets are flexible, route them early)
  const sortedNetsAsc = [...nets].sort((a, b) => a.pins.length - b.pins.length);
  let bestResult: ReturnType<typeof routeLayer1Strip> | null = null;
  let bestFailCount = Infinity;

  for (let attempt = 0; attempt < phase1Limit; attempt++) {
    if (attempt > 0 && phase1Deadline && Date.now() > phase1Deadline) break;
    let orderedNets: NetGroup[];
    if (attempt === 0) {
      orderedNets = sortedNets;
    } else if (attempt === 1) {
      orderedNets = nets;
    } else if (attempt === 2) {
      orderedNets = sortedNetsAsc;
    } else {
      orderedNets = shuffleArray(nets, attempt * 7919).map(net => ({
        ...net,
        pins: shuffleArray(net.pins, attempt * 3571 + net.netCode),
      }));
    }
    const mstSeed = attempt > 2 && attempt % 2 === 0 ? attempt * 6271 : 0;
    const result = routeLayer1Strip(orderedNets, pinCells, costs, boardCols, boardRows, mstSeed);
    if (result.failed.length < bestFailCount || (result.failed.length === bestFailCount && bestResult && result.cost < bestResult.cost)) {
      bestResult = result;
      bestFailCount = result.failed.length;
      if (bestFailCount === 0) break;
    }
  }

  if (fullMode) console.log(`[routing:strip] Phase 1: ${bestFailCount} failures`);

  // Phase 2: Targeted rip-up — route the failed net solo on an empty board to
  // find its ideal path, then identify which other nets block those cells.
  // Rip the blockers + failed net, then reroute with failed net first.
  if (fullMode && bestFailCount > 0) {
    const phase2Deadline = Date.now() + 5000;

    for (let ripIter = 0; ripIter < 10; ripIter++) {
      if (bestFailCount === 0 || Date.now() > phase2Deadline) break;

      const failedNetNames = [...new Set(bestResult!.failed.map(f => f.netName))];
      let improved = false;

      for (const fName of failedNetNames) {
        if (bestFailCount === 0 || Date.now() > phase2Deadline) break;
        const fNet = nets.find(n => n.netName === fName)!;

        // Route the failed net alone on an empty board to find its ideal path
        const soloResult = routeLayer1Strip([fNet], pinCells, costs, boardCols, boardRows);
        if (soloResult.failed.length > 0) continue; // Can't even route solo — skip

        // Find which cells the ideal path uses
        const idealCells = new Set<string>();
        for (const line of soloResult.lines) {
          for (const cell of expandPathCellsWithAxis(line.path)) {
            idealCells.add(`${cell.x},${cell.y}`);
          }
        }

        // Find which nets in our current solution block those cells
        const cellToNet = buildCellToNetMap(bestResult!.lines);
        const blockingNets = new Set<string>();
        for (const cellKey of idealCells) {
          const netsAtCell = cellToNet.get(cellKey);
          if (netsAtCell) {
            for (const n of netsAtCell) {
              if (n !== fName) blockingNets.add(n);
            }
          }
        }

        // Also add row-neighbor blockers for wider rip on later iterations
        if (ripIter >= 3 && blockingNets.size > 0) {
          const margin = ripIter < 6 ? 2 : 4;
          for (const seg of bestResult!.failed.filter(s => s.netName === fName)) {
            const minRow = Math.min(seg.p1.y, seg.p2.y) - margin;
            const maxRow = Math.max(seg.p1.y, seg.p2.y) + margin;
            for (let row = Math.max(0, minRow); row <= Math.min(boardRows - 1, maxRow); row++) {
              for (let col = 0; col < boardCols; col++) {
                const netsAtCell = cellToNet.get(`${col},${row}`);
                if (netsAtCell) for (const n of netsAtCell) if (n !== fName) blockingNets.add(n);
              }
            }
          }
        }

        if (blockingNets.size === 0) continue;

        if (ripIter === 0) console.log(`[routing:strip] Phase 2: ${fName} blocked by ${blockingNets.size} nets`);

        // Rip blocking nets + failed net, reroute with failed net first
        const netsToRip = new Set([...blockingNets, fName]);
        const rippedNets = nets.filter(n => netsToRip.has(n.netName));
        const keptNets = nets.filter(n => !netsToRip.has(n.netName));

        for (let orderSeed = 0; orderSeed < 15; orderSeed++) {
          if (Date.now() > phase2Deadline) break;
          let ordered: NetGroup[];
          if (orderSeed === 0) {
            ordered = [fNet, ...rippedNets.filter(n => n.netName !== fName)];
          } else if (orderSeed === 1) {
            ordered = [...rippedNets.filter(n => n.netName !== fName), fNet];
          } else {
            ordered = shuffleArray(rippedNets, orderSeed * 7919 + ripIter * 100000).map(n => ({
              ...n, pins: shuffleArray(n.pins, orderSeed * 3571 + n.netCode),
            }));
          }
          const mstSeed = orderSeed > 2 && orderSeed % 2 === 0 ? orderSeed * 6271 + ripIter * 9999 : 0;
          const fullOrder = [...keptNets, ...ordered];
          const result = routeLayer1Strip(fullOrder, pinCells, costs, boardCols, boardRows, mstSeed);
          if (result.failed.length < bestFailCount ||
              (result.failed.length === bestFailCount && result.cost < bestResult!.cost)) {
            bestResult = result;
            bestFailCount = result.failed.length;
            improved = true;
            if (bestFailCount === 0) break;
          }
        }
      }
      if (!improved || bestFailCount === 0) break;
    }
    console.log(`[routing:strip] Phase 2 (rip-up): ${bestFailCount} failures`);
  }

  // Phase 3: Nuclear — full re-route of ALL nets from scratch with many orderings.
  // Failed nets go first to give them priority.
  if (fullMode && bestFailCount > 0) {
    const phase3Deadline = Date.now() + 5000;
    const failedNames = new Set(bestResult!.failed.map(f => f.netName));
    const failedNetsList = nets.filter(n => failedNames.has(n.netName));
    const successNetsList = nets.filter(n => !failedNames.has(n.netName));

    for (let attempt = 0; attempt < 500; attempt++) {
      if (Date.now() > phase3Deadline || bestFailCount === 0) break;
      let orderedNets: NetGroup[];
      if (attempt === 0) {
        orderedNets = [...failedNetsList, ...successNetsList];
      } else if (attempt === 1) {
        orderedNets = [...failedNetsList, ...sortedNets.filter(n => !failedNames.has(n.netName))];
      } else if (attempt === 2) {
        orderedNets = [...successNetsList, ...failedNetsList];
      } else {
        orderedNets = shuffleArray(nets, attempt * 7919 + 5000000).map(n => ({
          ...n, pins: shuffleArray(n.pins, attempt * 3571 + n.netCode),
        }));
      }
      const mstSeed = attempt > 2 && attempt % 2 === 0 ? attempt * 6271 : 0;
      const result = routeLayer1Strip(orderedNets, pinCells, costs, boardCols, boardRows, mstSeed);
      if (result.failed.length < bestFailCount ||
          (result.failed.length === bestFailCount && result.cost < bestResult!.cost)) {
        bestResult = result;
        bestFailCount = result.failed.length;
      }
    }

    // Phase 3b: Rip-up on nuclear result
    if (bestFailCount > 0) {
      const phase3bDeadline = Date.now() + 3000;
      for (let ripIter = 0; ripIter < 5; ripIter++) {
        if (bestFailCount === 0 || Date.now() > phase3bDeadline) break;
        const fNames = [...new Set(bestResult!.failed.map(f => f.netName))];
        for (const fName of fNames) {
          if (bestFailCount === 0 || Date.now() > phase3bDeadline) break;
          const fNet = nets.find(n => n.netName === fName)!;
          const soloResult = routeLayer1Strip([fNet], pinCells, costs, boardCols, boardRows);
          if (soloResult.failed.length > 0) continue;
          const idealCells = new Set<string>();
          for (const line of soloResult.lines) {
            for (const cell of expandPathCellsWithAxis(line.path)) idealCells.add(`${cell.x},${cell.y}`);
          }
          const cellToNet = buildCellToNetMap(bestResult!.lines);
          const blockingNets = new Set<string>();
          for (const ck of idealCells) {
            const ns = cellToNet.get(ck);
            if (ns) for (const n of ns) if (n !== fName) blockingNets.add(n);
          }
          if (blockingNets.size === 0) continue;
          const netsToRip = new Set([...blockingNets, fName]);
          const rippedNets = nets.filter(n => netsToRip.has(n.netName));
          const keptNets = nets.filter(n => !netsToRip.has(n.netName));
          for (let attempt = 0; attempt < 15; attempt++) {
            if (Date.now() > phase3bDeadline) break;
            let ordered: NetGroup[];
            if (attempt === 0) {
              ordered = [fNet, ...rippedNets.filter(n => n.netName !== fName)];
            } else {
              ordered = shuffleArray(rippedNets, attempt * 7919 + ripIter * 200000).map(n => ({
                ...n, pins: shuffleArray(n.pins, attempt * 3571 + n.netCode),
              }));
            }
            const mstSeed = attempt > 2 && attempt % 2 === 0 ? attempt * 6271 + ripIter * 9999 : 0;
            const result = routeLayer1Strip([...keptNets, ...ordered], pinCells, costs, boardCols, boardRows, mstSeed);
            if (result.failed.length < bestFailCount ||
                (result.failed.length === bestFailCount && result.cost < bestResult!.cost)) {
              bestResult = result;
              bestFailCount = result.failed.length;
              if (bestFailCount === 0) break;
            }
          }
        }
      }
    }
    console.log(`[routing:strip] Phase 3 (nuclear): ${bestFailCount} failures`);
  }

  const { lines, failed: failedSegments, cost: layer1Cost, stripRowNets, isolationCuts: bestIsolationCuts } = bestResult!;
  let totalCost = layer1Cost;
  let failedCount = 0;

  const jumperBudget = maxLayer2 ?? failedSegments.length;
  if (failedSegments.length > 0) {
    let jumpersUsed = 0;
    for (const seg of failedSegments) {
      if (jumpersUsed >= jumperBudget) {
        lines.push({ path: [seg.p1, seg.p2], netName: seg.netName, failed: true });
        failedCount++;
        totalCost += 100_000;
        continue;
      }
      lines.push({ path: [seg.p1, seg.p2], netName: seg.netName, layer: 2 });
      totalCost += Math.abs(seg.p1.x - seg.p2.x) + Math.abs(seg.p1.y - seg.p2.y);
      jumpersUsed++;
    }
  }

  // Generate strip cuts from the routing result (net boundary cuts + isolation cuts)
  const finalCutsSet = computeStripCutsSet(stripRowNets, boardCols, boardRows);
  for (const ic of bestIsolationCuts) finalCutsSet.add(ic);
  const stripCuts: StripCut[] = [];
  for (const key of finalCutsSet) {
    const [row, col] = key.split(',').map(Number);
    stripCuts.push({ row, col });
  }

  const metrics = computeRoutingMetrics(lines);
  return { lines, totalCost, failedCount, stripCuts, ...metrics };
}

/**
 * Generate strip cuts from the strip row net ownership map.
 * A cut is placed between two adjacent columns on the same row
 * whenever the owning net changes.
 */
function generateStripCutsFromRowNets(
  stripRowNets: Map<string, string>,
  boardCols: number,
  boardRows: number,
): StripCut[] {
  const cuts: StripCut[] = [];
  for (let row = 0; row < boardRows; row++) {
    let prevNet: string | undefined;
    let prevCol = -1;
    for (let col = 0; col < boardCols; col++) {
      const net = stripRowNets.get(`${col},${row}`);
      if (net) {
        if (prevNet && net !== prevNet) {
          // Cut between prevCol and col
          cuts.push({ row, col: prevCol });
        }
        prevNet = net;
        prevCol = col;
      }
    }
  }
  return cuts;
}

/**
 * Route nets in a given order on layer 1.
 * Supports pre-populated grid state (for rip-up and reroute).
 */
function routeLayer1(
  orderedNets: NetGroup[],
  pinCells: Set<string>,
  costs: RoutingCosts,
  boardCols: number,
  boardRows: number,
  initialDirs?: Map<string, number>,
  initialLines?: RatsnestLine[],
  randomMst?: number // seed for random MST connection order (0 = greedy nearest-neighbor)
): { lines: RatsnestLine[]; dirs: Map<string, number>; failed: FailedSegment[]; cost: number } {
  const dirs = initialDirs ? new Map(initialDirs) : new Map<string, number>();
  const lines: RatsnestLine[] = initialLines ? [...initialLines] : [];
  const failed: FailedSegment[] = [];
  let cost = 0;

  for (const net of orderedNets) {
    const netPaths: Array<Array<{ x: number; y: number }>> = [];

    // Same-net pins are electrically connected — routes can pass through them freely.
    const netOwnPins = new Set(net.pins.map(p => `${p.x},${p.y}`));
    const routePinCells = netOwnPins.size > 0
      ? new Set([...pinCells].filter(c => !netOwnPins.has(c)))
      : pinCells;

    // MST-style routing: connect unconnected parts via pin pairs.
    // Use `dirs` (not a snapshot) so same-net segments DON'T block each other —
    // on a perfboard, overlapping wires of the same net are electrically fine.
    const connectedParts = new Set<string>([net.pins[0].partKey]);
    const uniqueParts = new Set(net.pins.map(p => p.partKey));

    while (connectedParts.size < uniqueParts.size) {
      let bestFrom: NetPin | null = null;
      let bestTo: NetPin | null = null;

      if (randomMst) {
        // Random MST: collect all candidate pairs, then pick one randomly.
        // This creates different tree topologies that may route better.
        const candidates: Array<{ from: NetPin; to: NetPin; dist: number }> = [];
        for (const pin of net.pins) {
          if (!connectedParts.has(pin.partKey)) continue;
          for (const other of net.pins) {
            if (connectedParts.has(other.partKey)) continue;
            candidates.push({ from: pin, to: other, dist: Math.abs(pin.x - other.x) + Math.abs(pin.y - other.y) });
          }
        }
        if (candidates.length > 0) {
          // Pick from top candidates with bias toward shorter distances
          candidates.sort((a, b) => a.dist - b.dist);
          let s = randomMst + connectedParts.size * 7919 + net.netCode * 3571;
          s = (s * 1664525 + 1013904223) >>> 0;
          const pick = s % Math.min(candidates.length, Math.max(3, candidates.length >> 1));
          bestFrom = candidates[pick].from;
          bestTo = candidates[pick].to;
        }
      } else {
        // Greedy nearest-neighbor MST
        let bestDist = Infinity;
        for (const pin of net.pins) {
          if (!connectedParts.has(pin.partKey)) continue;
          for (const other of net.pins) {
            if (connectedParts.has(other.partKey)) continue;
            const dist = Math.abs(pin.x - other.x) + Math.abs(pin.y - other.y);
            if (dist < bestDist) {
              bestDist = dist;
              bestFrom = pin;
              bestTo = other;
            }
          }
        }
      }

      if (!bestFrom || !bestTo) break;

      // Direct adjacency short-circuit: skip A* for pins that are already neighbors
      const manDist = Math.abs(bestFrom.x - bestTo.x) + Math.abs(bestFrom.y - bestTo.y);
      if (manDist <= 1) {
        const path = [{ x: bestFrom.x, y: bestFrom.y }, { x: bestTo.x, y: bestTo.y }];
        lines.push({ path, netName: net.netName, layer: 1 });
        netPaths.push(path);
        // Direct = essentially free (just a solder blob)
        cost += 1;
      } else {
        const result = aStarRoute(bestFrom, bestTo, routePinCells, dirs, boardCols, boardRows, costs);
        if (result) {
          lines.push({ path: result.path, netName: net.netName, layer: 1 });
          netPaths.push(result.path);
          cost += result.cost;
        } else {
          failed.push({ p1: bestFrom, p2: bestTo, netName: net.netName });
        }
      }

      connectedParts.add(bestTo.partKey);
    }

    for (const path of netPaths) {
      for (const pt of expandPathCellsWithAxis(path)) {
        const k = `${pt.x},${pt.y}`;
        if (!pinCells.has(k)) {
          dirs.set(k, (dirs.get(k) ?? 0) | pt.axis);
        }
      }
    }
  }

  return { lines, dirs, failed, cost };
}

/**
 * Compute strip cuts between adjacent cells of different nets on the same row.
 * Returns a Set of "row,col" keys where a cut exists between col and col+1.
 */
function computeStripCutsSet(
  stripRowNets: Map<string, string>,
  boardCols: number,
  boardRows: number,
): Set<string> {
  const cuts = new Set<string>();
  for (let row = 0; row < boardRows; row++) {
    let prevNet: string | undefined;
    let prevCol = -1;
    for (let col = 0; col < boardCols; col++) {
      const net = stripRowNets.get(`${col},${row}`);
      if (net) {
        if (prevNet && net !== prevNet) {
          // Cut between the two different-net cells
          cuts.add(`${row},${prevCol}`);
        }
        prevNet = net;
        prevCol = col;
      }
    }
  }
  return cuts;
}

/**
 * Compute segment ownership for every cell on the board.
 * A strip segment is a maximal run of cells on a row between cuts.
 * If any cell in a segment is owned by a net, the whole segment is owned by that net.
 * Returns Map<"x,y", netName | null>.
 */
function computeSegmentOwners(
  cuts: Set<string>,
  stripRowNets: Map<string, string>,
  boardCols: number,
  boardRows: number,
): Map<string, string | null> {
  const segOwner = new Map<string, string | null>();
  for (let row = 0; row < boardRows; row++) {
    // Find segment boundaries for this row
    const segments: Array<{ start: number; end: number }> = [];
    let segStart = 0;
    for (let col = 0; col < boardCols; col++) {
      if (col > 0 && cuts.has(`${row},${col - 1}`)) {
        segments.push({ start: segStart, end: col - 1 });
        segStart = col;
      }
    }
    segments.push({ start: segStart, end: boardCols - 1 });

    // For each segment, find owner (the net that owns any cell in it)
    for (const seg of segments) {
      let owner: string | null = null;
      for (let col = seg.start; col <= seg.end; col++) {
        const net = stripRowNets.get(`${col},${row}`);
        if (net) {
          if (owner === null) {
            owner = net;
          } else if (owner !== net) {
            // Multiple different nets in one segment — shouldn't happen with correct cuts
            // Mark as conflicted so no net can use it
            owner = "__conflict__";
            break;
          }
        }
      }
      // Assign owner to all cells in segment
      for (let col = seg.start; col <= seg.end; col++) {
        segOwner.set(`${col},${row}`, owner);
      }
    }
  }
  return segOwner;
}

/**
 * Route nets on a stripboard. Horizontal movement is free on uncut strips.
 * Tracks which net owns each strip cell to prevent conflicts.
 */
function routeLayer1Strip(
  orderedNets: NetGroup[],
  pinCells: Set<string>,
  costs: RoutingCosts,
  boardCols: number,
  boardRows: number,
  randomMst?: number,
): { lines: RatsnestLine[]; dirs: Map<string, number>; failed: FailedSegment[]; cost: number; stripRowNets: Map<string, string>; isolationCuts: Set<string> } {
  const dirs = new Map<string, number>();
  const lines: RatsnestLine[] = [];
  const failed: FailedSegment[] = [];
  let cost = 0;
  // Track which net owns each cell on the strip (row-based connectivity)
  const stripRowNets = new Map<string, string>();
  // Isolation cuts: cuts placed around cells where vertical wires cross alien strips
  const isolationCuts = new Set<string>();

  // Pre-mark ALL pins from ALL nets before routing any net
  // This is critical: on a stripboard, all pins on the same row are connected
  // by the copper strip unless cuts separate them.
  for (const net of orderedNets) {
    for (const pin of net.pins) {
      stripRowNets.set(`${pin.x},${pin.y}`, net.netName);
    }
  }

  // Pre-compute strip cuts and segment owners
  let cuts = computeStripCutsSet(stripRowNets, boardCols, boardRows);
  let segOwners = computeSegmentOwners(cuts, stripRowNets, boardCols, boardRows);

  for (const net of orderedNets) {
    const netPaths: Array<Array<{ x: number; y: number }>> = [];

    const netOwnPins = new Set(net.pins.map(p => `${p.x},${p.y}`));
    const routePinCells = netOwnPins.size > 0
      ? new Set([...pinCells].filter(c => !netOwnPins.has(c)))
      : pinCells;

    const connectedParts = new Set<string>([net.pins[0].partKey]);
    const uniqueParts = new Set(net.pins.map(p => p.partKey));

    while (connectedParts.size < uniqueParts.size) {
      let bestFrom: NetPin | null = null;
      let bestTo: NetPin | null = null;

      if (randomMst) {
        const candidates: Array<{ from: NetPin; to: NetPin; dist: number }> = [];
        for (const pin of net.pins) {
          if (!connectedParts.has(pin.partKey)) continue;
          for (const other of net.pins) {
            if (connectedParts.has(other.partKey)) continue;
            candidates.push({ from: pin, to: other, dist: Math.abs(pin.x - other.x) + Math.abs(pin.y - other.y) });
          }
        }
        if (candidates.length > 0) {
          candidates.sort((a, b) => a.dist - b.dist);
          let s = randomMst + connectedParts.size * 7919 + net.netCode * 3571;
          s = (s * 1664525 + 1013904223) >>> 0;
          const pick = s % Math.min(candidates.length, Math.max(3, candidates.length >> 1));
          bestFrom = candidates[pick].from;
          bestTo = candidates[pick].to;
        }
      } else {
        let bestDist = Infinity;
        for (const pin of net.pins) {
          if (!connectedParts.has(pin.partKey)) continue;
          for (const other of net.pins) {
            if (connectedParts.has(other.partKey)) continue;
            const dist = Math.abs(pin.x - other.x) + Math.abs(pin.y - other.y);
            if (dist < bestDist) {
              bestDist = dist;
              bestFrom = pin;
              bestTo = other;
            }
          }
        }
      }

      if (!bestFrom || !bestTo) break;

      const result = aStarRouteStrip(bestFrom, bestTo, routePinCells, dirs, boardCols, boardRows, costs, net.netName, stripRowNets, cuts, segOwners);
      if (result) {
        lines.push({ path: result.path, netName: net.netName, layer: 1 });
        netPaths.push(result.path);
        cost += result.cost;
      } else {
        failed.push({ p1: bestFrom, p2: bestTo, netName: net.netName });
      }

      connectedParts.add(bestTo.partKey);
    }

    // Mark routed cells on strips for this net
    // For cells that cross alien-owned strip segments vertically, add isolation cuts
    // instead of claiming the cell for the current net.
    for (const path of netPaths) {
      for (const pt of expandPathCellsWithAxis(path)) {
        const k = `${pt.x},${pt.y}`;
        const existingOwner = stripRowNets.get(k);
        const isVerticalCrossing = (pt.axis & AXIS_V) !== 0 && (pt.axis & AXIS_H) === 0;
        if (existingOwner && existingOwner !== net.netName && isVerticalCrossing) {
          // Isolation cut: don't claim this cell, but add cuts on both sides
          // so the strip segment is broken around this cell
          if (pt.x > 0) isolationCuts.add(`${pt.y},${pt.x - 1}`);
          if (pt.x < boardCols - 1) isolationCuts.add(`${pt.y},${pt.x}`);
        } else {
          stripRowNets.set(k, net.netName);
        }
        if (!pinCells.has(k)) {
          dirs.set(k, (dirs.get(k) ?? 0) | pt.axis);
        }
      }
    }

    // Recompute cuts and segment owners after marking new cells
    cuts = computeStripCutsSet(stripRowNets, boardCols, boardRows);
    for (const ic of isolationCuts) cuts.add(ic);
    segOwners = computeSegmentOwners(cuts, stripRowNets, boardCols, boardRows);
  }

  return { lines, dirs, failed, cost, stripRowNets, isolationCuts };
}

/**
 * Shuffle array in-place (Fisher-Yates) with a simple seed.
 */
function shuffleArray<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Build a cell→netName map from routing lines, for rip-up identification.
 */
function buildCellToNetMap(lines: RatsnestLine[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const line of lines) {
    if (line.failed || line.layer === 2) continue;
    for (const cell of expandPathCellsWithAxis(line.path)) {
      const k = `${cell.x},${cell.y}`;
      if (!map.has(k)) map.set(k, new Set());
      map.get(k)!.add(line.netName);
    }
  }
  return map;
}

/**
 * Remove all routes belonging to specific nets from a result.
 * Returns { keptDirs, keptLines } with those nets stripped out.
 */
function stripNets(
  result: { lines: RatsnestLine[]; dirs: Map<string, number> },
  netNames: Set<string>,
  pinCells: Set<string>
): { dirs: Map<string, number>; lines: RatsnestLine[] } {
  const keptLines = result.lines.filter(l => !netNames.has(l.netName));
  // Rebuild dirs from kept lines only
  const dirs = new Map<string, number>();
  for (const line of keptLines) {
    if (line.failed || line.layer === 2) continue;
    for (const pt of expandPathCellsWithAxis(line.path)) {
      const k = `${pt.x},${pt.y}`;
      if (!pinCells.has(k)) {
        dirs.set(k, (dirs.get(k) ?? 0) | pt.axis);
      }
    }
  }
  return { dirs, lines: keptLines };
}

/**
 * Route a set of nets given placements. Returns lines + total cost.
 *
 * Layer 1: routes through pin holes. Perpendicular crossings allowed (penalized).
 *   Parallel overlap always forbidden.
 * Jumper wires (layer 2): direct straight lines from pin to pin (free wires
 *   on the back of the board). Not grid-routed.
 *
 * maxLayer2: cap on jumper wires allowed. If undefined, unlimited.
 *   When 0, tries many net orderings to find a single-layer solution.
 */
export function routeNets(
  nets: NetGroup[],
  placements: PartPlacement[],
  costs: RoutingCosts,
  boardCols: number,
  boardRows: number,
  maxLayer2?: number,
  quick?: boolean,
  deadline?: number,
  boardType?: "perfboard" | "stripboard",
): RoutingResult {
  // Build pin cells from ALL placements
  const pinCells = new Set<string>();
  for (const placement of placements) {
    for (const pin of placement.pins) {
      pinCells.add(`${pin.x},${pin.y}`);
    }
  }

  // ─── Stripboard routing path ───
  if (boardType === "stripboard") {
    return routeNetsStrip(nets, placements, pinCells, costs, boardCols, boardRows, maxLayer2, quick, deadline);
  }

  const fullMode = !quick;
  const noJumpers = maxLayer2 !== undefined && maxLayer2 === 0;

  // Phase 1: Try net orderings WITHOUT crossings.
  const noCrossingCosts: RoutingCosts = { ...costs, routeCost: 20001 };
  const phase1Limit = quick ? (noJumpers ? 20 : 5) : (noJumpers ? 1000 : 30);
  const phase1Deadline = fullMode ? Date.now() + 5000 : deadline;
  let bestResult: { lines: RatsnestLine[]; dirs: Map<string, number>; failed: FailedSegment[]; cost: number } | null = null;
  let bestFailCount = Infinity;

  // Shortest-nets-first: nets with shorter estimated wire length route first
  // (they're less likely to block longer routes). Fall back to pin count for ties.
  const netHPWL = (n: NetGroup) => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of n.pins) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    return (maxX - minX) + (maxY - minY);
  };
  const sortedNets = [...nets].sort((a, b) => netHPWL(a) - netHPWL(b) || b.pins.length - a.pins.length);
  for (let attempt = 0; attempt < phase1Limit; attempt++) {
    if (attempt > 0 && phase1Deadline && Date.now() > phase1Deadline) break;
    let orderedNets: NetGroup[];
    if (attempt === 0) {
      orderedNets = sortedNets;
    } else if (attempt === 1) {
      orderedNets = nets;
    } else {
      orderedNets = shuffleArray(nets, attempt * 7919).map(net => ({
        ...net,
        pins: shuffleArray(net.pins, attempt * 3571 + net.netCode),
      }));
    }
    const mstSeed = attempt > 2 && attempt % 2 === 0 ? attempt * 6271 : 0;
    const result = routeLayer1(orderedNets, pinCells, noCrossingCosts, boardCols, boardRows, undefined, undefined, mstSeed);
    if (result.failed.length < bestFailCount) {
      bestResult = result;
      bestFailCount = result.failed.length;
      if (bestFailCount === 0) break;
    }
  }

  if (fullMode) console.log(`[routing] Phase 1 (no-crossing): ${bestFailCount} failures`);

  // Phase 2: Skip full re-route with crossings (too slow for large boards).
  // Go directly to Phase 3 rip-up which is much more efficient — it only
  // re-routes the failing nets and their immediate blockers with crossings.

  // Phase 3: Rip-up and reroute — targeted removal of blocking routes.
  // For each failed segment, find its ideal path, identify blocking nets,
  // remove them, route the failed net first, then re-route displaced nets.
  if (bestFailCount > 0 && fullMode) {
    const phase3Deadline = Date.now() + 5000;

    for (let ripIteration = 0; ripIteration < 8; ripIteration++) {
      if (bestFailCount === 0 || Date.now() > phase3Deadline) break;

      const failedNetNames = [...new Set(bestResult!.failed.map(f => f.netName))];

      for (const fName of failedNetNames) {
        if (bestFailCount === 0 || Date.now() > phase3Deadline) break;
        const fNet = nets.find(n => n.netName === fName)!;

        // Step 1: Check if the failed segment can be routed alone (empty grid)
        const soloResult = routeLayer1([fNet], pinCells, noCrossingCosts, boardCols, boardRows);
        if (soloResult.failed.length > 0) continue;

        // Step 2: Find which cells the ideal path uses
        const idealCells = new Set<string>();
        for (const line of soloResult.lines) {
          for (const cell of expandPathCellsWithAxis(line.path)) {
            idealCells.add(`${cell.x},${cell.y}`);
          }
        }

        // Step 3: Find which nets block those cells in the current best result
        const cellToNet = buildCellToNetMap(bestResult!.lines);
        const blockingNets = new Set<string>();
        for (const cellKey of idealCells) {
          const netsAtCell = cellToNet.get(cellKey);
          if (netsAtCell) {
            for (const n of netsAtCell) {
              if (n !== fName) blockingNets.add(n);
            }
          }
        }

        if (ripIteration === 0) console.log(`[routing] Phase 3: ${fName} blocked by ${blockingNets.size} nets: ${[...blockingNets].join(', ')}`);
        if (blockingNets.size === 0) continue;

        // Step 4: Strip blocking nets + failed net from current solution
        const netsToRip = new Set([...blockingNets, fName]);
        const { dirs: keptDirs, lines: keptLines } = stripNets(bestResult!, netsToRip, pinCells);

        // Step 5: Re-route ALL ripped nets in various orderings.
        const allRippedNets = nets.filter(n => netsToRip.has(n.netName));

        for (let attempt = 0; attempt < 20; attempt++) {
          if (Date.now() > phase3Deadline) break;
          let ordered: NetGroup[];
          if (attempt === 0) {
            ordered = [fNet, ...allRippedNets.filter(n => n.netName !== fName)];
          } else if (attempt === 1) {
            ordered = [...allRippedNets.filter(n => n.netName !== fName), fNet];
          } else {
            ordered = shuffleArray(allRippedNets, attempt * 7919 + ripIteration * 100000).map(n => ({
              ...n, pins: shuffleArray(n.pins, attempt * 3571 + n.netCode),
            }));
          }
          const mstSeed3 = attempt > 2 && attempt % 2 === 0 ? attempt * 6271 + ripIteration * 9999 : 0;
          const ripResult = routeLayer1(ordered, pinCells, noCrossingCosts, boardCols, boardRows, keptDirs, keptLines, mstSeed3);
          if (ripResult.failed.length < bestFailCount ||
              (ripResult.failed.length === bestFailCount && ripResult.cost < bestResult!.cost)) {
            bestResult = ripResult;
            bestFailCount = ripResult.failed.length;
            if (bestFailCount === 0) break;
          }
        }
      }
    }

    // Phase 3b: Wide rip — rip ALL nets in the neighborhood of the failed
    // segment (not just direct blockers). Try increasing margins.
    for (const margin of [3, 5, Infinity]) {
      if (bestFailCount === 0 || Date.now() > phase3Deadline) break;

      const cellToNet = buildCellToNetMap(bestResult!.lines);
      const wideRipNets = new Set<string>();

      for (const seg of bestResult!.failed) {
        wideRipNets.add(seg.netName);
        if (margin === Infinity) {
          // Rip ALL nets
          for (const net of nets) wideRipNets.add(net.netName);
        } else {
          const minX = Math.min(seg.p1.x, seg.p2.x) - margin;
          const maxX = Math.max(seg.p1.x, seg.p2.x) + margin;
          const minY = Math.min(seg.p1.y, seg.p2.y) - margin;
          const maxY = Math.max(seg.p1.y, seg.p2.y) + margin;
          for (const [cellKey, netsAtCell] of cellToNet) {
            const [cx, cy] = cellKey.split(',').map(Number);
            if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) {
              for (const n of netsAtCell) wideRipNets.add(n);
            }
          }
        }
      }

      if (wideRipNets.size > 0) {
        const { dirs: wideDirs, lines: wideLines } = stripNets(bestResult!, wideRipNets, pinCells);
        const wideNetsToRoute = nets.filter(n => wideRipNets.has(n.netName));
        const attemptsForMargin = margin === Infinity ? 40 : 20;

        for (let attempt = 0; attempt < attemptsForMargin; attempt++) {
          if (Date.now() > phase3Deadline) break;
          let ordered: NetGroup[];
          if (attempt === 0) {
            ordered = [...wideNetsToRoute].sort((a, b) => b.pins.length - a.pins.length);
          } else if (attempt === 1) {
            // Failed nets first, then rest sorted
            const failedNames = new Set(bestResult!.failed.map(f => f.netName));
            const failedFirst = wideNetsToRoute.filter(n => failedNames.has(n.netName));
            const rest = wideNetsToRoute.filter(n => !failedNames.has(n.netName));
            ordered = [...failedFirst, ...rest];
          } else {
            ordered = shuffleArray(wideNetsToRoute, attempt * 7919 + 8000000 + margin * 1000).map(n => ({
              ...n, pins: shuffleArray(n.pins, attempt * 3571 + n.netCode),
            }));
          }

          // For Infinity margin (full rip), use noCrossingCosts — a completely fresh no-crossing attempt
          const useCosts = margin === Infinity ? noCrossingCosts : noCrossingCosts;
          const mstSeed3b = attempt > 2 && attempt % 2 === 0 ? attempt * 6271 + margin * 3333 : 0;
          const ripResult = routeLayer1(ordered, pinCells, useCosts, boardCols, boardRows, wideDirs, wideLines, mstSeed3b);
          if (ripResult.failed.length < bestFailCount ||
              (ripResult.failed.length === bestFailCount && ripResult.cost < bestResult!.cost)) {
            bestResult = ripResult;
            bestFailCount = ripResult.failed.length;
            if (bestFailCount === 0) break;
          }
        }
      }
    }

    // Phase 3c: Nuclear — full re-route of ALL nets with crossings,
    // then apply targeted rip-up to the result.
    if (bestFailCount > 0) {
      console.log(`[routing] Phase 3c: nuclear fallback (${bestFailCount} failures remain)`);
      const phase3cDeadline = Date.now() + 5000;
      const failedNames = new Set(bestResult!.failed.map(f => f.netName));
      const failedNetsList = nets.filter(n => failedNames.has(n.netName));
      const successNetsList = nets.filter(n => !failedNames.has(n.netName));

      for (let attempt = 0; attempt < 100; attempt++) {
        if (Date.now() > phase3cDeadline || bestFailCount === 0) break;
        let ordered: NetGroup[];
        if (attempt === 0) {
          ordered = [...failedNetsList, ...successNetsList];
        } else if (attempt === 1) {
          ordered = sortedNets;
        } else if (attempt === 2) {
          ordered = [...successNetsList, ...failedNetsList];
        } else {
          ordered = shuffleArray(nets, attempt * 7919 + 9000000).map(n => ({
            ...n, pins: shuffleArray(n.pins, attempt * 3571 + n.netCode),
          }));
        }
        const mstSeed3c = attempt > 2 && attempt % 2 === 0 ? attempt * 6271 : 0;
        const result = routeLayer1(ordered, pinCells, noCrossingCosts, boardCols, boardRows, undefined, undefined, mstSeed3c);
        if (result.failed.length < bestFailCount ||
            (result.failed.length === bestFailCount && result.cost < bestResult!.cost)) {
          bestResult = result;
          bestFailCount = result.failed.length;
        }
      }

      // Rip-up on the Phase 3c nuclear result
      for (let ripIteration = 0; ripIteration < 5; ripIteration++) {
        if (bestFailCount === 0 || Date.now() > phase3cDeadline) break;
        const fNames = [...new Set(bestResult!.failed.map(f => f.netName))];
        for (const fName of fNames) {
          if (bestFailCount === 0 || Date.now() > phase3cDeadline) break;
          const fNet = nets.find(n => n.netName === fName)!;
          const soloResult = routeLayer1([fNet], pinCells, noCrossingCosts, boardCols, boardRows);
          if (soloResult.failed.length > 0) continue;
          const idealCells = new Set<string>();
          for (const line of soloResult.lines) {
            for (const cell of expandPathCellsWithAxis(line.path)) idealCells.add(`${cell.x},${cell.y}`);
          }
          const cellToNet = buildCellToNetMap(bestResult!.lines);
          const blockingNets = new Set<string>();
          for (const ck of idealCells) {
            const ns = cellToNet.get(ck);
            if (ns) for (const n of ns) if (n !== fName) blockingNets.add(n);
          }
          if (blockingNets.size === 0) continue;
          const netsToRip = new Set([...blockingNets, fName]);
          const { dirs: keptDirs, lines: keptLines } = stripNets(bestResult!, netsToRip, pinCells);
          const allRippedNets = nets.filter(n => netsToRip.has(n.netName));
          for (let attempt = 0; attempt < 20; attempt++) {
            if (Date.now() > phase3cDeadline) break;
            let ordered: NetGroup[];
            if (attempt === 0) {
              ordered = [fNet, ...allRippedNets.filter(n => n.netName !== fName)];
            } else if (attempt === 1) {
              ordered = [...allRippedNets.filter(n => n.netName !== fName), fNet];
            } else {
              ordered = shuffleArray(allRippedNets, attempt * 7919 + ripIteration * 200000).map(n => ({
                ...n, pins: shuffleArray(n.pins, attempt * 3571 + n.netCode),
              }));
            }
            const mstSeed3cr = attempt > 2 && attempt % 2 === 0 ? attempt * 6271 + ripIteration * 9999 : 0;
            const ripResult = routeLayer1(ordered, pinCells, noCrossingCosts, boardCols, boardRows, keptDirs, keptLines, mstSeed3cr);
            if (ripResult.failed.length < bestFailCount ||
                (ripResult.failed.length === bestFailCount && ripResult.cost < bestResult!.cost)) {
              bestResult = ripResult;
              bestFailCount = ripResult.failed.length;
              if (bestFailCount === 0) break;
            }
          }
        }
      }
    }

    if (bestFailCount > 0) console.log(`[routing] Phase 3 (rip-up): ${bestFailCount} failures remain`);
    else console.log(`[routing] Phase 3 (rip-up): resolved all failures`);
  }

  const { lines, failed: failedSegments, cost: layer1Cost } = bestResult!;
  let totalCost = layer1Cost;
  let failedCount = 0;

  // Layer 2 (jumper wires): direct straight lines from pin to pin.
  const jumperBudget = maxLayer2 ?? failedSegments.length;

  if (failedSegments.length > 0) {
    let jumpersUsed = 0;

    for (const seg of failedSegments) {
      if (jumpersUsed >= jumperBudget) {
        lines.push({ path: [seg.p1, seg.p2], netName: seg.netName, failed: true });
        failedCount++;
        totalCost += FAILED_ROUTE_PENALTY;
        continue;
      }
      lines.push({ path: [seg.p1, seg.p2], netName: seg.netName, layer: 2 });
      totalCost += Math.abs(seg.p1.x - seg.p2.x) + Math.abs(seg.p1.y - seg.p2.y);
      jumpersUsed++;
    }
  }

  const metrics = computeRoutingMetrics(lines);
  return { lines, totalCost, failedCount, ...metrics };
}
