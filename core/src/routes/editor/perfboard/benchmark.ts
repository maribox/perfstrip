import type { AdvancedConfig, AcoVariant, RoutingCosts, AlgorithmFamily, PlaceRouteApproach, PlacementResult } from "./overviewPlacement";
import { computeSmartPlacements } from "./overviewPlacement";
import type { RoutingResult } from "./routing";
import type { Part, PinPosition } from "$lib/types";

// ─── Types ───

export type ApproachType = "algorithm" | "parameter" | "combined";

export interface BenchmarkApproach {
  name: string;
  algorithm: AlgorithmFamily;
  type: ApproachType;
  generation: number;
  config: AdvancedConfig;
}

export interface BenchmarkResult {
  name: string;
  algorithm: string;
  type: ApproachType;
  generation: number;
  scenario: string;
  failedRoutes: number;
  unplacedParts: number;
  jumpers: number;
  bends: number;
  crossings: number;
  directConnections: number;
  boardArea: number;
  boardPerimeter: number;
  boardCols: number;
  boardRows: number;
  wireLength: number;
  jumperLength: number;
  totalCost: number;
  cost: number;
  adjustedCost: number;
  timeMs: number;
  status: "pending" | "running" | "done" | "error";
  error?: string;
  placementResult?: PlacementResult;
}

export interface BenchmarkScenario {
  name: string;
  maxCols?: number;
  maxRows?: number;
  maxSum?: number;
  maxJumpers: number;
}

export interface BenchmarkInput {
  parts: Record<string, Part>;
  parsedKiCadDoc: any;
  getFootprintInfo: (part: Part) => { pins: PinPosition[]; w: number; h: number } | null;
  maxJumpers: number;
  maxCols?: number;
  maxRows?: number;
  maxSum?: number;
  scenarios?: BenchmarkScenario[];
}

// ─── Cost function (lower = better) ───
// Wire: 6/hop, jumper wire: 4/hop, 150/jumper flat, 0.5/direct, 4/bend,
// 2000/unrouted, 200/crossing, 2/area, 3/perimeter-unit (penalizes elongation)

export function computeCost(r: BenchmarkResult): number {
  const directCost = r.directConnections * 0.5;
  const wireCost = r.wireLength * 6;
  const jumperWireCost = r.jumperLength * 4;
  const bendCost = r.bends * 4;
  const unroutedCost = r.failedRoutes * 2000;
  const unplacedCost = r.unplacedParts * 50000;
  const jumperCost = r.jumpers * 150;
  const crossingCost = r.crossings * 200;
  const areaCost = r.boardArea * 2;
  const perimeterCost = r.boardPerimeter * 3;
  return Math.round(directCost + wireCost + jumperWireCost + bendCost + unroutedCost + unplacedCost + jumperCost + crossingCost + areaCost + perimeterCost);
}

// Time-aware cost: mildly penalizes slower algorithms (15% penalty at full timeout)
export function computeAdjustedCost(r: BenchmarkResult, timeoutMs: number, timeWeight = 0.15): number {
  const baseCost = computeCost(r);
  const timeFactor = 1 + timeWeight * (r.timeMs / timeoutMs);
  return Math.round(baseCost * timeFactor);
}

// ─── Parameter Spaces (per algorithm family) ───

interface ParamRange {
  min: number;
  max: number;
  scale: "linear" | "log";
  integer?: boolean;
}

// Shared params used by algorithms that evaluate candidates
const SHARED_RANGES: Record<string, ParamRange> = {
  compactnessWeight:     { min: 0.5,  max: 15,   scale: "linear" },
  connStrength:          { min: 0,    max: 8,    scale: "linear" },
  targetedSamplingRatio: { min: 0,    max: 0.8,  scale: "linear" },
  clearanceWeight:       { min: 0,    max: 3,    scale: "linear" },
  candidateListSize:     { min: 10,   max: 60,   scale: "linear", integer: true },
};

const ACO_BASE_RANGES: Record<string, ParamRange> = {
  numAnts:               { min: 3,    max: 50,    scale: "linear", integer: true },
  numIterations:         { min: 5,    max: 50,    scale: "linear", integer: true },
  alpha:                 { min: 0.3,  max: 5.0,   scale: "linear" },
  beta:                  { min: 0.5,  max: 5.0,   scale: "linear" },
  rho:                   { min: 0.05, max: 0.9,   scale: "linear" },
  Q:                     { min: 1,    max: 10000, scale: "log" },
  elitistWeight:         { min: 0,    max: 5,     scale: "linear" },
  minPheromone:          { min: 0.01, max: 2.0,   scale: "log" },
  maxPheromone:          { min: 3,    max: 100,   scale: "log" },
  pheromoneInit:         { min: 0.1,  max: 10.0,  scale: "log" },
  localSearchMoves:      { min: 5,    max: 150,   scale: "linear", integer: true },
};

const ACS_EXTRA: Record<string, ParamRange> = {
  q0:        { min: 0.1,  max: 0.95, scale: "linear" },
  localDecay: { min: 0.01, max: 0.3,  scale: "linear" },
};

const RANK_EXTRA: Record<string, ParamRange> = {
  rankW: { min: 2, max: 10, scale: "linear", integer: true },
};

const SA_RANGES: Record<string, ParamRange> = {
  saTemperature:  { min: 5,    max: 100,   scale: "linear" },
  saCoolingRate:  { min: 0.85, max: 0.999, scale: "linear" },
  saInnerIter:    { min: 5,    max: 100,   scale: "linear", integer: true },
};

const GA_RANGES: Record<string, ParamRange> = {
  gaPopSize:       { min: 8,   max: 50,  scale: "linear", integer: true },
  gaGenerations:   { min: 5,   max: 80,  scale: "linear", integer: true },
  gaCrossoverRate: { min: 0.3, max: 0.9, scale: "linear" },
  gaMutationRate:  { min: 0.05, max: 0.5, scale: "linear" },
};

const TABU_RANGES: Record<string, ParamRange> = {
  tabuTenure:  { min: 3,  max: 30,  scale: "linear", integer: true },
  tabuMaxIter: { min: 50, max: 500, scale: "linear", integer: true },
};

const HC_RANGES: Record<string, ParamRange> = {
  hcRestarts: { min: 3,  max: 30,  scale: "linear", integer: true },
  hcMaxIter:  { min: 20, max: 300, scale: "linear", integer: true },
};

const ILS_RANGES: Record<string, ParamRange> = {
  ilsPerturbStrength: { min: 1,  max: 8,   scale: "linear", integer: true },
  ilsMaxIter:         { min: 20, max: 200, scale: "linear", integer: true },
  ilsAcceptWorse:     { min: 0,  max: 0.2, scale: "linear" },
};

const LAHC_RANGES: Record<string, ParamRange> = {
  lahcHistoryLength: { min: 10, max: 200, scale: "linear", integer: true },
  lahcMaxIter:       { min: 50, max: 500, scale: "linear", integer: true },
};

const GRASP_RANGES: Record<string, ParamRange> = {
  graspRestarts: { min: 3,  max: 20,  scale: "linear", integer: true },
  graspLsIter:   { min: 10, max: 100, scale: "linear", integer: true },
};

const MEMETIC_RANGES: Record<string, ParamRange> = {
  memeticPopSize:       { min: 6,    max: 25,  scale: "linear", integer: true },
  memeticGenerations:   { min: 5,    max: 40,  scale: "linear", integer: true },
  memeticCrossoverRate: { min: 0.3,  max: 0.9, scale: "linear" },
  memeticMutationRate:  { min: 0.05, max: 0.5, scale: "linear" },
  memeticLsIter:        { min: 5,    max: 40,  scale: "linear", integer: true },
};

const LNS_RANGES: Record<string, ParamRange> = {
  lnsDestroyRatio: { min: 0.15, max: 0.6, scale: "linear" },
  lnsMaxIter:      { min: 20,   max: 200, scale: "linear", integer: true },
};

const VNS_RANGES: Record<string, ParamRange> = {
  vnsKmax:    { min: 2,  max: 10,  scale: "linear", integer: true },
  vnsMaxIter: { min: 20, max: 200, scale: "linear", integer: true },
};

const RRT_RANGES: Record<string, ParamRange> = {
  rrtDeviation: { min: 0.01, max: 0.15, scale: "linear" },
  rrtMaxIter:   { min: 50,   max: 400,  scale: "linear", integer: true },
};

const SCATTER_RANGES: Record<string, ParamRange> = {
  scatterRefSize: { min: 4,  max: 20, scale: "linear", integer: true },
  scatterMaxIter: { min: 10, max: 60, scale: "linear", integer: true },
};

const BLS_RANGES: Record<string, ParamRange> = {
  blsPenaltyWeight: { min: 10, max: 200, scale: "linear" },
  blsMaxIter:       { min: 50, max: 400, scale: "linear", integer: true },
};

function getParamRanges(algo: AlgorithmFamily): Record<string, ParamRange> {
  switch (algo) {
    case "aco-mmas":
    case "aco-as":
      return { ...SHARED_RANGES, ...ACO_BASE_RANGES };
    case "aco-acs":
      return { ...SHARED_RANGES, ...ACO_BASE_RANGES, ...ACS_EXTRA };
    case "aco-rank":
      return { ...SHARED_RANGES, ...ACO_BASE_RANGES, ...RANK_EXTRA };
    case "sa":
      return { ...SHARED_RANGES, ...SA_RANGES };
    case "greedy":
      return { ...SHARED_RANGES };
    case "ga":
      return { ...SHARED_RANGES, ...GA_RANGES };
    case "tabu":
      return { ...SHARED_RANGES, ...TABU_RANGES };
    case "hill-climbing":
      return { ...SHARED_RANGES, ...HC_RANGES };
    case "ils":
      return { ...SHARED_RANGES, ...ILS_RANGES };
    case "lahc":
      return { ...SHARED_RANGES, ...LAHC_RANGES };
    case "grasp":
      return { ...SHARED_RANGES, ...GRASP_RANGES };
    case "memetic":
      return { ...SHARED_RANGES, ...MEMETIC_RANGES };
    case "lns":
      return { ...SHARED_RANGES, ...LNS_RANGES };
    case "vns":
      return { ...SHARED_RANGES, ...VNS_RANGES };
    case "rrt":
      return { ...SHARED_RANGES, ...RRT_RANGES };
    case "scatter":
      return { ...SHARED_RANGES, ...SCATTER_RANGES };
    case "bls":
      return { ...SHARED_RANGES, ...BLS_RANGES };
  }
}

const PART_ORDER_STRATEGIES = ["largest-first", "most-connected", "random"] as const;

const ALL_ALGORITHMS: AlgorithmFamily[] = [
  "lns", "sa", "tabu", "ils", "lahc",
];

// ─── Config Sampling & Mutation ───

function sampleParam(range: ParamRange): number {
  const r = Math.random();
  let val: number;
  if (range.scale === "log") {
    val = Math.exp(Math.log(range.min) + r * (Math.log(range.max) - Math.log(range.min)));
  } else {
    val = range.min + r * (range.max - range.min);
  }
  if (range.integer) val = Math.round(val);
  return parseFloat(val.toPrecision(4));
}

function sampleConfig(algo: AlgorithmFamily): AdvancedConfig {
  const config: AdvancedConfig = {};
  const ranges = getParamRanges(algo);

  // Set ACO variant for ACO algorithms
  if (algo.startsWith("aco-")) {
    const suffix = algo.replace("aco-", "");
    config.acoVariant = (suffix === "rank" ? "rank-based" : suffix) as AcoVariant;
  }

  for (const [key, range] of Object.entries(ranges)) {
    (config as any)[key] = sampleParam(range);
  }

  // Discrete params
  config.partOrderStrategy = PART_ORDER_STRATEGIES[Math.floor(Math.random() * 3)];
  if (algo.startsWith("aco-")) {
    config.localSearchEnabled = Math.random() > 0.3;
  }
  if (algo === "lns") {
    config.lnsAdaptive = Math.random() > 0.3;
  }

  return config;
}

function gaussianRandom(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1 || 1e-10)) * Math.cos(2 * Math.PI * u2);
}

function clampParam(val: number, range: ParamRange): number {
  let clamped = Math.max(range.min, Math.min(range.max, val));
  if (range.integer) clamped = Math.round(clamped);
  return parseFloat(clamped.toPrecision(4));
}

function mutateConfig(config: AdvancedConfig, algo: AlgorithmFamily): AdvancedConfig {
  const mutated = { ...config };
  const ranges = getParamRanges(algo);

  for (const [key, range] of Object.entries(ranges)) {
    const current = (config as any)[key] as number | undefined;
    if (current === undefined) continue;
    if (range.scale === "log") {
      const logVal = Math.log(current);
      const logRange = Math.log(range.max) - Math.log(range.min);
      const sigma = logRange * 0.2;
      (mutated as any)[key] = clampParam(Math.exp(logVal + gaussianRandom() * sigma), range);
    } else {
      const span = range.max - range.min;
      const sigma = span * 0.2;
      (mutated as any)[key] = clampParam(current + gaussianRandom() * sigma, range);
    }
  }

  // Discrete mutations (10% chance each)
  if (Math.random() < 0.1) {
    mutated.partOrderStrategy = PART_ORDER_STRATEGIES[Math.floor(Math.random() * 3)];
  }
  if (algo.startsWith("aco-") && Math.random() < 0.1) {
    mutated.localSearchEnabled = !mutated.localSearchEnabled;
  }
  if (algo === "lns" && Math.random() < 0.1) {
    mutated.lnsAdaptive = !mutated.lnsAdaptive;
  }

  return mutated;
}

// ─── Approach Generation ───

function algorithmToApproach(algo: AlgorithmFamily): PlaceRouteApproach {
  if (algo.startsWith("aco-") || algo === "greedy") return "greedy-route";
  if (algo === "sa") return "sa";
  if (algo === "ga") return "ga";
  if (algo === "tabu") return "tabu";
  if (algo === "hill-climbing") return "hill-climbing";
  if (algo === "ils") return "ils";
  if (algo === "lahc") return "lahc";
  if (algo === "grasp") return "grasp";
  if (algo === "memetic") return "memetic";
  if (algo === "lns") return "lns";
  if (algo === "vns") return "vns";
  if (algo === "rrt") return "rrt";
  if (algo === "scatter") return "scatter";
  if (algo === "bls") return "bls";
  return "greedy-route";
}

export function generateInitialApproaches(samplesPerAlgo = 8): BenchmarkApproach[] {
  const approaches: BenchmarkApproach[] = [];
  let idx = 0;
  for (const algo of ALL_ALGORITHMS) {
    for (let i = 0; i < samplesPerAlgo; i++) {
      approaches.push({
        name: `${algo}-g0-${idx}`,
        algorithm: algo,
        type: "algorithm",
        generation: 0,
        config: sampleConfig(algo),
      });
      idx++;
    }
  }
  return approaches;
}

export function evolveApproaches(
  completedResults: BenchmarkResult[],
  completedApproaches: BenchmarkApproach[],
  generation: number,
  topK = 8,
  childrenPerParent = 3,
): BenchmarkApproach[] {
  const sorted = completedResults
    .filter(r => r.status === "done")
    .slice()
    .sort((a, b) => a.adjustedCost - b.adjustedCost);

  const parents = sorted.slice(0, topK);
  const children: BenchmarkApproach[] = [];
  let idx = 0;

  for (const parent of parents) {
    const parentApproach = completedApproaches.find(a => a.name === parent.name);
    if (!parentApproach) continue;
    for (let c = 0; c < childrenPerParent; c++) {
      const mutated = mutateConfig(parentApproach.config, parentApproach.algorithm);
      children.push({
        name: `${parentApproach.algorithm}-g${generation}-${idx}`,
        algorithm: parentApproach.algorithm,
        type: "combined",
        generation,
        config: mutated,
      });
      idx++;
    }
  }
  return children;
}

// ─── Benchmark Runner ───

const DEFAULT_COSTS: RoutingCosts = { stepCost: 50, bendCost: 50, pinCost: 20500, routeCost: 20001 };

function countJumpers(routing: RoutingResult): number {
  return routing.lines.filter(l => !l.failed && l.layer === 2).length;
}

function computeWireLengths(routing: RoutingResult): { wireLength: number; jumperLength: number } {
  let wireLength = 0;
  let jumperLength = 0;
  for (const line of routing.lines) {
    if (line.failed) continue;
    let len = 0;
    for (let j = 1; j < line.path.length; j++) {
      len += Math.abs(line.path[j].x - line.path[j - 1].x) + Math.abs(line.path[j].y - line.path[j - 1].y);
    }
    if (line.layer === 2) {
      jumperLength += len;
    } else {
      wireLength += len;
    }
  }
  return { wireLength, jumperLength };
}

async function evaluateApproach(
  input: BenchmarkInput,
  approach: BenchmarkApproach,
  perRunTimeout: number,
  scenario?: BenchmarkScenario,
): Promise<BenchmarkResult> {
  const scenarioName = scenario?.name ?? "default";
  const maxJumpers = scenario?.maxJumpers ?? input.maxJumpers;
  const maxCols = scenario?.maxCols ?? input.maxCols;
  const maxRows = scenario?.maxRows ?? input.maxRows;
  const maxSum = scenario?.maxSum ?? input.maxSum;

  const result: BenchmarkResult = {
    name: scenario ? `${approach.name}[${scenarioName}]` : approach.name,
    algorithm: approach.algorithm,
    type: approach.type,
    generation: approach.generation,
    scenario: scenarioName,
    failedRoutes: 0, unplacedParts: 0, jumpers: 0, bends: 0, crossings: 0, directConnections: 0,
    boardArea: 0, boardPerimeter: 0, boardCols: 0, boardRows: 0, wireLength: 0, jumperLength: 0,
    totalCost: 0, cost: 0, adjustedCost: 0, timeMs: 0,
    status: "running",
  };

  const startTime = performance.now();
  try {
    const placementApproach = algorithmToApproach(approach.algorithm);
    const placementResult = computeSmartPlacements({
      parts: input.parts,
      parsedKiCadDoc: input.parsedKiCadDoc,
      manualPositions: {},
      getFootprintInfo: input.getFootprintInfo,
      routingCosts: DEFAULT_COSTS,
      approach: placementApproach,
      timeoutMs: perRunTimeout,
      flexResistors: false,
      boardType: "perfboard",
      maxJumpers,
      maxCols,
      maxRows,
      maxSum,
      advancedConfig: approach.config,
    });

    // Routing is integrated into placement — use the result directly
    const routingResult = placementResult.routing!;

    result.placementResult = placementResult;
    result.boardCols = placementResult.boardCols;
    result.boardRows = placementResult.boardRows;
    result.boardArea = placementResult.boardCols * placementResult.boardRows;
    result.boardPerimeter = 2 * (placementResult.boardCols + placementResult.boardRows);
    // Count parts that have footprints but weren't placed
    const placedKeys = new Set(placementResult.placements.map(p => p.partKey));
    result.unplacedParts = Object.entries(input.parts).filter(([k, p]) => p.footprint && !placedKeys.has(k)).length;
    result.failedRoutes = routingResult.failedCount;
    result.jumpers = countJumpers(routingResult);
    result.bends = routingResult.bends;
    result.crossings = routingResult.crossings;
    result.directConnections = routingResult.directConnections;
    const wireLengths = computeWireLengths(routingResult);
    result.wireLength = wireLengths.wireLength;
    result.jumperLength = wireLengths.jumperLength;
    result.totalCost = routingResult.totalCost;
    result.timeMs = Math.round(performance.now() - startTime);
    result.status = "done";
    result.cost = computeCost(result);
    result.adjustedCost = computeAdjustedCost(result, perRunTimeout);
  } catch (e: any) {
    result.status = "error";
    result.error = e.message ?? String(e);
    result.timeMs = Math.round(performance.now() - startTime);
    result.cost = 999999;
    result.adjustedCost = 999999;
  }
  return result;
}

export interface BenchmarkProgress {
  index: number;
  result: BenchmarkResult;
  approach: BenchmarkApproach;
  generation: number;
  generationTotal: number;
  generationDone: number;
}

// ─── Export for optimization feedback ───

export function exportResults(
  results: BenchmarkResult[],
  approaches: BenchmarkApproach[],
  input?: BenchmarkInput,
): string {
  // Debug: include part dimensions and scenario constraints
  const debug: Record<string, any> = {};
  if (input) {
    const partSizes: Record<string, string> = {};
    for (const [key, part] of Object.entries(input.parts)) {
      const info = input.getFootprintInfo(part);
      if (info) partSizes[key] = `${info.w}x${info.h}`;
      else partSizes[key] = "no footprint";
    }
    debug.partSizes = partSizes;
    debug.scenarios = buildScenarios(input).map(s => ({
      name: s.name,
      maxCols: s.maxCols ?? "none",
      maxRows: s.maxRows ?? "none",
      maxSum: s.maxSum ?? "none",
      maxJumpers: s.maxJumpers,
    }));
    debug.inputConstraints = {
      maxCols: input.maxCols ?? "none",
      maxRows: input.maxRows ?? "none",
      maxSum: input.maxSum ?? "none",
      maxJumpers: input.maxJumpers,
    };
  }

  const rows = results
    .filter(r => r.status === "done")
    .sort((a, b) => a.adjustedCost - b.adjustedCost)
    .map(r => {
      // Strip scenario suffix [xxx] from result name to match approach name
      const baseName = r.name.replace(/\[.*\]$/, "");
      const approach = approaches.find(a => a.name === baseName);
      const cfg = approach?.config ?? {};

      // Debug: placement positions and overlap/overflow detection
      let placementDebug: any = undefined;
      if (r.placementResult && input) {
        const pl = r.placementResult;
        const parts: Record<string, any> = {};
        const issues: string[] = [];
        const placedKeys = new Set<string>();

        for (const p of pl.placements) {
          placedKeys.add(p.partKey);
          const part = input.parts[p.partKey];
          const info = part ? input.getFootprintInfo(part) : null;
          const rot = pl.rotations[p.partKey] ?? 0;
          let w = info?.w ?? 0, h = info?.h ?? 0;
          if (rot === 1 || rot === 3) { const tmp = w; w = h; h = tmp; }
          const endX = p.offsetX + w;
          const endY = p.offsetY + h;
          parts[p.partKey] = { pos: `${p.offsetX},${p.offsetY}`, size: `${w}x${h}`, rot, end: `${endX},${endY}` };
          if (endX > pl.boardCols) issues.push(`${p.partKey} overflows X: end=${endX} > board=${pl.boardCols}`);
          if (endY > pl.boardRows) issues.push(`${p.partKey} overflows Y: end=${endY} > board=${pl.boardRows}`);
        }

        // Check for missing parts
        for (const key of Object.keys(input.parts)) {
          if (!placedKeys.has(key)) issues.push(`${key} NOT PLACED`);
        }

        // Check for overlaps
        const entries = pl.placements.map(p => {
          const part = input.parts[p.partKey];
          const info = part ? input.getFootprintInfo(part) : null;
          const rot = pl.rotations[p.partKey] ?? 0;
          let w = info?.w ?? 0, h = info?.h ?? 0;
          if (rot === 1 || rot === 3) { const tmp = w; w = h; h = tmp; }
          return { key: p.partKey, x: p.offsetX, y: p.offsetY, w, h };
        });
        for (let i = 0; i < entries.length; i++) {
          for (let j = i + 1; j < entries.length; j++) {
            const a = entries[i], b = entries[j];
            if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) {
              issues.push(`OVERLAP: ${a.key} (${a.x},${a.y} ${a.w}x${a.h}) vs ${b.key} (${b.x},${b.y} ${b.w}x${b.h})`);
            }
          }
        }

        placementDebug = { parts, placedCount: pl.placements.length, totalParts: Object.keys(input.parts).length };
        if (issues.length > 0) placementDebug.issues = issues;
      }

      return {
        name: r.name,
        algorithm: r.algorithm,
        scenario: r.scenario,
        gen: r.generation,
        cost: r.cost,
        adjustedCost: r.adjustedCost,
        failed: r.failedRoutes,
        unplaced: r.unplacedParts,
        jumpers: r.jumpers,
        jumperLength: r.jumperLength,
        bends: r.bends,
        crossings: r.crossings,
        direct: r.directConnections,
        board: `${r.boardCols}x${r.boardRows}`,
        wire: r.wireLength,
        timeMs: r.timeMs,
        config: cfg,
        placement: placementDebug,
      };
    });
  return JSON.stringify({ debug, results: rows }, null, 2);
}

// ─── Main benchmark generator ───

function makeRunningResult(approach: BenchmarkApproach, gen: number, scenario?: BenchmarkScenario): BenchmarkResult {
  const scenarioName = scenario?.name ?? "default";
  return {
    name: scenario ? `${approach.name}[${scenarioName}]` : approach.name,
    algorithm: approach.algorithm,
    type: approach.type,
    generation: gen,
    scenario: scenarioName,
    failedRoutes: 0, unplacedParts: 0, jumpers: 0, bends: 0, crossings: 0, directConnections: 0,
    boardArea: 0, boardPerimeter: 0, boardCols: 0, boardRows: 0, wireLength: 0, jumperLength: 0,
    totalCost: 0, cost: 0, adjustedCost: 0, timeMs: 0,
    status: "running",
  };
}

/** Build default test scenarios from current settings + constrained variants */
function buildScenarios(input: BenchmarkInput): BenchmarkScenario[] {
  // Find minimum feasible board dimensions considering rotation
  let minDim = 0;        // smallest dimension of largest part (rotated to fit)
  let maxPartW = 0;      // widest part in default orientation
  let maxPartH = 0;      // tallest part in default orientation
  let totalArea = 0;
  for (const [, part] of Object.entries(input.parts)) {
    const info = input.getFootprintInfo(part);
    if (!info) continue;
    minDim = Math.max(minDim, Math.min(info.w, info.h));
    maxPartW = Math.max(maxPartW, info.w);
    maxPartH = Math.max(maxPartH, info.h);
    totalArea += info.w * info.h;
  }
  // Board must be wide/tall enough for the largest part rotated, plus routing margin
  const narrowCols = minDim + 4;
  const shortRows = minDim + 4;

  const scenarios: BenchmarkScenario[] = [];
  scenarios.push({
    name: "open",
    maxCols: input.maxCols,
    maxRows: input.maxRows,
    maxSum: input.maxSum,
    maxJumpers: input.maxJumpers,
  });
  scenarios.push({
    name: `narrow (≤${narrowCols}col)`,
    maxCols: narrowCols,
    maxRows: undefined,
    maxSum: undefined,
    maxJumpers: 3,
  });
  scenarios.push({
    name: `short (≤${shortRows}row)`,
    maxCols: undefined,
    maxRows: shortRows,
    maxSum: undefined,
    maxJumpers: 3,
  });
  if (input.scenarios) scenarios.push(...input.scenarios);
  return scenarios;
}

export async function* runBenchmark(
  input: BenchmarkInput,
  maxGenerations = 5,
  samplesPerAlgo = 5,
  perRunTimeout = 15000,
): AsyncGenerator<BenchmarkProgress> {
  const scenarios = buildScenarios(input);
  // Gen 0: random samples across all algorithm families
  const gen0 = generateInitialApproaches(samplesPerAlgo);
  const allApproaches: BenchmarkApproach[] = [...gen0];
  const allResults: BenchmarkResult[] = [];
  let globalIdx = 0;

  const totalGen0 = gen0.length * scenarios.length;

  for (let i = 0; i < gen0.length; i++) {
    const approach = gen0[i];
    for (let s = 0; s < scenarios.length; s++) {
      const scenario = scenarios[s];
      yield {
        index: globalIdx,
        result: makeRunningResult(approach, 0, scenario),
        approach,
        generation: 0,
        generationTotal: totalGen0,
        generationDone: i * scenarios.length + s,
      };
      await new Promise(r => setTimeout(r, 0));

      const result = await evaluateApproach(input, approach, perRunTimeout, scenario);
      allResults.push(result);
      yield {
        index: globalIdx,
        result,
        approach,
        generation: 0,
        generationTotal: totalGen0,
        generationDone: i * scenarios.length + s + 1,
      };
      globalIdx++;
    }
  }

  // Gen 1+: evolutionary refinement (cross-family competition)
  // For evolution, use average adjustedCost across scenarios per approach
  for (let gen = 1; gen < maxGenerations; gen++) {
    // Compute average cost per approach across scenarios
    const approachAvg = new Map<string, number>();
    for (const approach of allApproaches) {
      const myResults = allResults.filter(r => r.name.startsWith(approach.name) && r.status === "done");
      if (myResults.length === 0) continue;
      const avg = myResults.reduce((sum, r) => sum + r.adjustedCost, 0) / myResults.length;
      // Create a synthetic result for evolution
      approachAvg.set(approach.name, avg);
    }
    // Build synthetic results for evolution (evolveApproaches works on BenchmarkResult[])
    const syntheticResults: BenchmarkResult[] = allApproaches
      .filter(a => approachAvg.has(a.name))
      .map(a => ({
        name: a.name,
        algorithm: a.algorithm,
        type: a.type,
        generation: a.generation,
        scenario: "avg",
        failedRoutes: 0, unplacedParts: 0, jumpers: 0, bends: 0, crossings: 0, directConnections: 0,
        boardArea: 0, boardPerimeter: 0, boardCols: 0, boardRows: 0, wireLength: 0, jumperLength: 0,
        totalCost: 0, cost: approachAvg.get(a.name)!, adjustedCost: approachAvg.get(a.name)!,
        timeMs: 0, status: "done" as const,
      }));

    const children = evolveApproaches(syntheticResults, allApproaches, gen);
    if (children.length === 0) break;
    allApproaches.push(...children);
    const totalGenN = children.length * scenarios.length;

    for (let i = 0; i < children.length; i++) {
      const approach = children[i];
      for (let s = 0; s < scenarios.length; s++) {
        const scenario = scenarios[s];
        yield {
          index: globalIdx,
          result: makeRunningResult(approach, gen, scenario),
          approach,
          generation: gen,
          generationTotal: totalGenN,
          generationDone: i * scenarios.length + s,
        };
        await new Promise(r => setTimeout(r, 0));

        const result = await evaluateApproach(input, approach, perRunTimeout, scenario);
        allResults.push(result);
        yield {
          index: globalIdx,
          result,
          approach,
          generation: gen,
          generationTotal: totalGenN,
          generationDone: i * scenarios.length + s + 1,
        };
        globalIdx++;
      }
    }
  }
}
