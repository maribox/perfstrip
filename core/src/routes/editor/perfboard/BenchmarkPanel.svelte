<script lang="ts">
  import { runBenchmark, exportResults, type BenchmarkResult, type BenchmarkInput, type BenchmarkProgress, type BenchmarkApproach } from "./benchmark";
  import type { Part, PinPosition } from "$lib/types";
  import type { AlgorithmFamily, PlacementResult } from "./overviewPlacement";

  interface Props {
    parts: Record<string, Part>;
    parsedKiCadDoc: any;
    getFootprintInfo: (part: Part) => { pins: PinPosition[]; w: number; h: number } | null;
    maxJumpers: number;
    maxCols?: number;
    maxRows?: number;
    maxSum?: number;
    onClose: () => void;
    onApplyResult?: (result: PlacementResult) => void;
  }

  const { parts, parsedKiCadDoc, getFootprintInfo, maxJumpers, maxCols, maxRows, maxSum, onClose, onApplyResult }: Props = $props();

  let results: BenchmarkResult[] = $state([]);
  let approaches: BenchmarkApproach[] = $state([]);
  let isRunning = $state(false);
  let stopped = $state(false);
  let copied = $state(false);
  let currentGen = $state(0);
  let genTotal = $state(0);
  let genDone = $state(0);
  let lastInput: BenchmarkInput | undefined = $state(undefined);
  let sortColumn: string = $state("adjustedCost");
  let sortAsc = $state(true);
  let filterAlgo: AlgorithmFamily | "" = $state("");

  const completedCount = $derived(results.filter(r => r.status === "done" || r.status === "error").length);
  const totalCount = $derived(results.length);

  const ALL_ALGOS: (AlgorithmFamily | "")[] = [
    "", "aco-mmas", "aco-acs", "aco-rank",
    "sa", "ga", "tabu",
    "ils", "lahc", "grasp", "memetic", "lns",
    "vns", "rrt", "scatter", "bls"
  ];

  const sortedResults = $derived.by(() => {
    let filtered = results.filter(r => r.status === "done" || r.status === "error");
    if (filterAlgo) {
      filtered = filtered.filter(r => r.algorithm === filterAlgo);
    }
    const col = sortColumn as keyof BenchmarkResult;
    filtered.sort((a, b) => {
      const aVal = a[col];
      const bVal = b[col];
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortAsc ? aVal - bVal : bVal - aVal;
      }
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return 0;
    });
    return filtered.map((r, i) => ({ ...r, rank: i + 1 }));
  });

  const bestAdjCost = $derived(
    sortedResults.length > 0 ? Math.min(...sortedResults.map(r => r.adjustedCost)) : Infinity
  );

  async function startBenchmark() {
    isRunning = true;
    stopped = false;
    copied = false;
    results = [];
    approaches = [];
    currentGen = 0;
    genTotal = 0;
    genDone = 0;

    const input: BenchmarkInput = { parts, parsedKiCadDoc, getFootprintInfo, maxJumpers, maxCols, maxRows, maxSum };
    lastInput = input;

    for await (const progress of runBenchmark(input)) {
      if (stopped) break;
      currentGen = progress.generation;
      genTotal = progress.generationTotal;
      genDone = progress.generationDone;

      // Track approach
      if (!approaches.find(a => a.name === progress.approach.name)) {
        approaches.push(progress.approach);
      }

      // Update or push result
      const existing = results.findIndex(r => r.name === progress.result.name);
      if (existing >= 0) {
        results[existing] = progress.result;
      } else {
        results.push(progress.result);
        results = results;
      }
    }

    isRunning = false;
  }

  function stopBenchmark() {
    stopped = true;
  }

  async function copyResults() {
    const json = exportResults(results, approaches, lastInput);
    await navigator.clipboard.writeText(json);
    copied = true;
    setTimeout(() => { copied = false; }, 2000);
  }

  function toggleSort(col: string) {
    if (sortColumn === col) {
      sortAsc = !sortAsc;
    } else {
      sortColumn = col;
      sortAsc = col === "cost" || col === "adjustedCost" || col === "failedRoutes" || col === "jumpers" || col === "jumperLength" || col === "bends" || col === "crossings" || col === "timeMs" || col === "boardArea" || col === "wireLength";
    }
  }

  function sortIcon(col: string): string {
    if (sortColumn !== col) return "";
    return sortAsc ? " \u25B2" : " \u25BC";
  }

  function algorithmLabel(algo: string): string {
    switch (algo) {
      case "aco-mmas": return "MMAS";
      case "aco-as": return "AS";
      case "aco-acs": return "ACS";
      case "aco-rank": return "Rank";
      case "sa": return "SA";
      case "greedy": return "Greedy";
      case "ga": return "GA";
      case "tabu": return "Tabu";
      case "hill-climbing": return "HC";
      case "ils": return "ILS";
      case "lahc": return "LAHC";
      case "grasp": return "GRASP";
      case "memetic": return "Memetic";
      case "lns": return "LNS";
      case "vns": return "VNS";
      case "rrt": return "RRT";
      case "scatter": return "Scatter";
      case "bls": return "BLS";
      default: return algo;
    }
  }

  function algoBadgeClass(algo: string): string {
    switch (algo) {
      case "aco-mmas": return "badge-success";
      case "aco-as": return "badge-warning";
      case "aco-acs": return "badge-info";
      case "aco-rank": return "badge-secondary";
      case "sa": return "badge-error";
      case "greedy": return "badge-accent";
      case "ga": return "badge-info badge-outline";
      case "tabu": return "badge-warning badge-outline";
      case "hill-climbing": return "badge-error badge-outline";
      case "ils": return "badge-primary";
      case "lahc": return "badge-neutral";
      case "grasp": return "badge-success badge-outline";
      case "memetic": return "badge-accent badge-outline";
      case "lns": return "badge-ghost";
      case "vns": return "badge-primary badge-outline";
      case "rrt": return "badge-secondary badge-outline";
      case "scatter": return "badge-warning";
      case "bls": return "badge-error";
      default: return "badge-ghost";
    }
  }
</script>

<div class="flex flex-col max-h-[85vh] overflow-hidden">
  <!-- Header -->
  <div class="flex items-center justify-between px-4 py-3 border-b border-base-300 bg-base-200/50">
    <div class="flex items-center gap-3">
      <h3 class="font-semibold text-sm">Placement Optimizer</h3>
      {#if completedCount > 0}
        <span class="badge badge-sm badge-info">{completedCount} done</span>
      {/if}
    </div>
    <div class="flex items-center gap-2">
      {#if isRunning}
        <div class="flex items-center gap-1.5">
          <span class="text-xs opacity-60">Gen {currentGen}:</span>
          <progress class="progress progress-primary w-28 h-2" value={genDone} max={genTotal}></progress>
          <span class="text-xs tabular-nums opacity-60">{genDone}/{genTotal}</span>
        </div>
        <button class="btn btn-xs btn-error" onclick={stopBenchmark}>Stop</button>
      {:else}
        <button class="btn btn-xs btn-primary" onclick={startBenchmark}
          disabled={Object.keys(parts).length === 0}>
          {completedCount > 0 ? "Re-run" : "Run"} Optimizer
        </button>
        {#if completedCount > 0}
          <button class="btn btn-xs btn-ghost" onclick={copyResults}>
            {copied ? "Copied!" : "Export"}
          </button>
        {/if}
      {/if}
      <button class="btn btn-xs btn-ghost" onclick={onClose}>Close</button>
    </div>
  </div>

  <!-- Filter -->
  {#if completedCount > 0}
    <div class="flex items-center gap-2 px-4 py-1.5 border-b border-base-300 bg-base-100">
      <span class="text-xs opacity-50">Algorithm:</span>
      <div class="flex flex-wrap gap-1">
        {#each ALL_ALGOS as a}
          <button
            class="badge badge-xs cursor-pointer transition-colors"
            class:badge-primary={filterAlgo === a}
            class:badge-ghost={filterAlgo !== a}
            onclick={() => { filterAlgo = filterAlgo === a ? "" : a; }}
          >
            {a ? algorithmLabel(a) : "All"}
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Table -->
  <div class="overflow-auto flex-1">
    {#if completedCount === 0 && !isRunning}
      <div class="flex items-center justify-center h-40 text-sm opacity-40">
        Click "Run Optimizer" to search across 15 algorithm families &times; 3 scenarios (open, narrow, short)
      </div>
    {:else}
      <table class="table table-xs table-pin-rows w-full">
        <thead>
          <tr class="text-[11px] bg-base-200">
            <th class="w-8 text-center" title="Click rank to apply placement">#</th>
            <th class="cursor-pointer select-none" onclick={() => toggleSort("name")}>Name{sortIcon("name")}</th>
            <th class="cursor-pointer select-none" onclick={() => toggleSort("algorithm")}>Algo{sortIcon("algorithm")}</th>
            <th class="cursor-pointer select-none text-center" onclick={() => toggleSort("generation")}>Gen{sortIcon("generation")}</th>
            <th class="cursor-pointer select-none" onclick={() => toggleSort("scenario")}>Scen{sortIcon("scenario")}</th>
            <th class="cursor-pointer select-none text-right" onclick={() => toggleSort("unplacedParts")}>Unpl{sortIcon("unplacedParts")}</th>
            <th class="cursor-pointer select-none text-right" onclick={() => toggleSort("failedRoutes")}>Fail{sortIcon("failedRoutes")}</th>
            <th class="cursor-pointer select-none text-right" onclick={() => toggleSort("jumpers")}>Jump{sortIcon("jumpers")}</th>
            <th class="cursor-pointer select-none text-right" onclick={() => toggleSort("jumperLength")}>JLen{sortIcon("jumperLength")}</th>
            <th class="cursor-pointer select-none text-right" onclick={() => toggleSort("bends")}>Bend{sortIcon("bends")}</th>
            <th class="cursor-pointer select-none text-right" onclick={() => toggleSort("crossings")}>Cross{sortIcon("crossings")}</th>
            <th class="cursor-pointer select-none text-right" onclick={() => toggleSort("directConnections")}>Dir{sortIcon("directConnections")}</th>
            <th class="cursor-pointer select-none text-right" onclick={() => toggleSort("boardArea")}>Board{sortIcon("boardArea")}</th>
            <th class="cursor-pointer select-none text-right" onclick={() => toggleSort("wireLength")}>Wire{sortIcon("wireLength")}</th>
            <th class="cursor-pointer select-none text-right" onclick={() => toggleSort("timeMs")}>Time{sortIcon("timeMs")}</th>
            <th class="cursor-pointer select-none text-right" onclick={() => toggleSort("cost")}>Cost{sortIcon("cost")}</th>
            <th class="cursor-pointer select-none text-right font-bold" onclick={() => toggleSort("adjustedCost")}>Adj{sortIcon("adjustedCost")}</th>
          </tr>
        </thead>
        <tbody>
          {#each sortedResults as row (row.name)}
            <tr
              class="hover:bg-base-200/50 transition-colors {row.failedRoutes > 0 ? 'bg-error/5' : ''} {row.adjustedCost === bestAdjCost && bestAdjCost < Infinity ? 'bg-success/10' : ''}"
            >
              <td class="tabular-nums text-center text-[10px]">
                {#if row.placementResult && onApplyResult}
                  <button
                    class="btn btn-xs btn-ghost px-1 min-h-0 h-5 text-[10px] opacity-60 hover:opacity-100 hover:btn-primary"
                    title="Apply this placement to the board"
                    onclick={() => { onApplyResult(row.placementResult!); onClose(); }}
                  >{row.rank}</button>
                {:else}
                  <span class="opacity-40">{row.rank}</span>
                {/if}
              </td>
              <td class="font-mono text-[11px] whitespace-nowrap">{row.name}</td>
              <td class="text-[10px] opacity-60 whitespace-nowrap">
                <span class="badge badge-xs {algoBadgeClass(row.algorithm)}">
                  {algorithmLabel(row.algorithm)}
                </span>
              </td>
              <td class="text-center tabular-nums text-[10px] opacity-50">{row.generation}</td>
              <td class="text-[10px] opacity-50 whitespace-nowrap">{row.scenario}</td>
              <td class="text-right tabular-nums" class:text-error={row.unplacedParts > 0} class:font-bold={row.unplacedParts > 0}>
                {row.unplacedParts}
              </td>
              <td class="text-right tabular-nums" class:text-error={row.failedRoutes > 0} class:font-bold={row.failedRoutes > 0}>
                {row.failedRoutes}
              </td>
              <td class="text-right tabular-nums">{row.jumpers}</td>
              <td class="text-right tabular-nums text-[11px]" class:text-warning={row.jumperLength > 0}>{row.jumperLength}</td>
              <td class="text-right tabular-nums">{row.bends}</td>
              <td class="text-right tabular-nums" class:text-warning={row.crossings > 0}>{row.crossings}</td>
              <td class="text-right tabular-nums text-success">{row.directConnections}</td>
              <td class="text-right tabular-nums text-[11px]">{row.boardCols}&times;{row.boardRows}</td>
              <td class="text-right tabular-nums">{row.wireLength}</td>
              <td class="text-right tabular-nums text-[11px]">{(row.timeMs / 1000).toFixed(1)}s</td>
              <td class="text-right tabular-nums text-[11px]">{row.cost.toLocaleString()}</td>
              <td class="text-right tabular-nums font-bold" class:text-success={row.adjustedCost === bestAdjCost && bestAdjCost < Infinity}>
                {row.adjustedCost.toLocaleString()}
              </td>
            </tr>
          {/each}
          {#if isRunning}
            {@const running = results.find(r => r.status === "running")}
            {#if running}
              <tr class="opacity-40">
                <td class="text-center"><span class="loading loading-spinner loading-xs"></span></td>
                <td class="font-mono text-[11px]">{running.name}</td>
                <td class="text-[10px]">{algorithmLabel(running.algorithm)}</td>
                <td colspan="14" class="text-center text-[10px] italic">running...</td>
              </tr>
            {/if}
          {/if}
        </tbody>
      </table>
    {/if}
  </div>

  <!-- Summary footer -->
  {#if completedCount > 0}
    {@const doneResults = results.filter(r => r.status === "done")}
    {@const zeroFail = doneResults.filter(r => r.failedRoutes === 0).length}
    {@const best = doneResults.length > 0 ? doneResults.reduce((a, b) => a.adjustedCost < b.adjustedCost ? a : b) : null}
    <div class="flex items-center justify-between px-4 py-2 border-t border-base-300 bg-base-200/30 text-[11px] opacity-60">
      <span>{zeroFail}/{doneResults.length} routed all nets</span>
      {#if best}
        <span>Best: {best.name} (adj: {best.adjustedCost.toLocaleString()}, cost: {best.cost.toLocaleString()})</span>
      {/if}
    </div>
  {/if}
</div>
