<script lang="ts">
  import { PerfBoard, PartsList } from "$lib/components";
  import { PaneGroup, Pane, PaneResizer } from "paneforge";
  import type { PinPosition } from "xtoedif";
  import type {
    FootprintEditState,
    OnEditFootprintFunction,
    OnEditMultipleFootprintsFunction,
    Part
  } from "$lib/types";
  import type { PlaceRouteApproach, PlacementResult } from "./overviewPlacement";
  import type { PlanarityResult } from "./planarity";
  import type { StripCut } from "./routing";
  import type { BoardType } from "./PerfboardEditor.svelte";
  import BenchmarkPanel from "./BenchmarkPanel.svelte";

  type PartPlacement = {
    partKey: string;
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
    pins: PinPosition[];
  };

  type RatsnestLine = { path: Array<{ x: number; y: number }>; netName: string; failed?: boolean; layer?: number };

  interface Props {
    parts: Record<string, Part>;
    footprintEditState: FootprintEditState;
    onEditFootprint: OnEditFootprintFunction;
    onFinishCurrentFootprint: () => void;
    onCancelCurrentFootprint: () => void;
    onEditMultipleFootprints: OnEditMultipleFootprintsFunction;
    onAddPart: () => void;
    onUploadSpice: (spiceContent: string) => void;
    placedParts: App.PlacedPart[];
    overviewPins: PinPosition[];
    overviewBoardCols: number;
    overviewBoardRows: number;
    overviewPlacements: PartPlacement[];
    ratsnestLines: RatsnestLine[];
    isGenerating: boolean;
    fixedPartKeys: Set<string>;
    onPartMove: (partKey: string, newX: number, newY: number) => void;
    onRotatePart: (partKey: string) => void;
    hasManualChanges: boolean;
    onReroute: () => void;
    onShuffle: () => void;
    onResetAll: () => void;
    onUnfixPart: (partKey: string) => void;
    bendCost: number;
    stepCost: number;
    onBendCostChange: (value: number) => void;
    onStepCostChange: (value: number) => void;
    maxBoardCols: number;
    maxBoardRows: number;
    maxBoardSum: number;
    currentBoardCols: number;
    currentBoardRows: number;
    onMaxBoardColsChange: (value: number) => void;
    onMaxBoardRowsChange: (value: number) => void;
    onMaxBoardSumChange: (value: number) => void;
    placementError?: string;
    planarityInfo: PlanarityResult;
    allowedJumpers: number;
    onAllowedJumpersChange: (value: number) => void;
    placementApproach: PlaceRouteApproach;
    onPlaceRouteApproachChange: (value: PlaceRouteApproach) => void;
    flexResistors: boolean;
    onFlexResistorsChange: (value: boolean) => void;
    beautyFilter: boolean;
    onBeautyFilterChange: (value: boolean) => void;
    boardType: BoardType;
    stripCuts: StripCut[];
    parsedKiCadDoc: any;
    getFootprintInfo: (part: Part) => { pins: PinPosition[]; w: number; h: number } | null;
    onApplyBenchmarkResult?: (result: PlacementResult) => void;
  }

  const {
    parts,
    footprintEditState,
    onEditFootprint,
    onFinishCurrentFootprint,
    onCancelCurrentFootprint,
    onEditMultipleFootprints,
    onAddPart,
    onUploadSpice,
    placedParts,
    overviewPins,
    overviewBoardCols,
    overviewBoardRows,
    overviewPlacements,
    ratsnestLines,
    isGenerating,
    fixedPartKeys,
    onPartMove,
    onRotatePart,
    hasManualChanges,
    onReroute,
    onShuffle,
    onResetAll,
    onUnfixPart,
    bendCost,
    stepCost,
    onBendCostChange,
    onStepCostChange,
    maxBoardCols,
    maxBoardRows,
    maxBoardSum,
    currentBoardCols,
    currentBoardRows,
    onMaxBoardColsChange,
    onMaxBoardRowsChange,
    onMaxBoardSumChange,
    placementError,
    planarityInfo,
    allowedJumpers,
    onAllowedJumpersChange,
    placementApproach,
    onPlaceRouteApproachChange,
    flexResistors,
    onFlexResistorsChange,
    beautyFilter,
    onBeautyFilterChange,
    boardType,
    stripCuts,
    parsedKiCadDoc,
    getFootprintInfo,
    onApplyBenchmarkResult,
  }: Props = $props();

  let showSettings = $state(false);
  let showBenchmark = $state(false);

  // Local buffer for W+H input to prevent value jumping during heavy recomputation
  let localSum = $state(String(maxBoardSum || (currentBoardCols + currentBoardRows)));
  $effect(() => {
    // Sync from parent (e.g., after shuffle resets to 0)
    localSum = String(maxBoardSum || (currentBoardCols + currentBoardRows));
  });
</script>

<PaneGroup direction="horizontal" class="flex-1 h-full">
  <Pane defaultSize={60} class="flex flex-col items-center justify-center relative">
    {#if placementError}
      <div class="absolute top-2 inset-x-4 z-10 bg-error/90 text-error-content text-xs rounded-lg px-3 py-1.5 text-center backdrop-blur">
        {placementError}
      </div>
    {/if}
    {#if isGenerating}
      <div class="absolute inset-0 z-20 flex items-center justify-center bg-base-300/50 backdrop-blur-sm">
        <span class="loading loading-spinner loading-lg"></span>
      </div>
    {/if}
    {#if planarityInfo.totalEdges > 0}
      <div class="absolute top-2 right-4 z-10 text-[10px] rounded-lg px-2 py-1 backdrop-blur {planarityInfo.isPlanar ? 'bg-success/80 text-success-content' : 'bg-warning/80 text-warning-content'}">
        {#if planarityInfo.isPlanar}
          Planar ({planarityInfo.totalEdges} edges)
        {:else}
          Non-planar — min {planarityInfo.minJumperWires} jumper{planarityInfo.minJumperWires !== 1 ? 's' : ''} needed
        {/if}
      </div>
    {/if}
    <PerfBoard
      numCols={overviewBoardCols}
      numRows={overviewBoardRows}
      {placedParts}
      selectedPins={overviewPins}
      partPlacements={overviewPlacements}
      {fixedPartKeys}
      {ratsnestLines}
      allowScaleUp={true}
      maxScale={3}
      {onPartMove}
      onPartRotate={onRotatePart}
      {onUnfixPart}
      {boardType}
      {stripCuts}
    />
    <!-- Prominent Re-route button — above bottom controls -->
    {#if hasManualChanges && !isGenerating}
      <div class="absolute inset-x-0 bottom-16 flex justify-center z-10 pointer-events-none">
        <button class="btn btn-primary shadow-xl pointer-events-auto" onclick={onReroute}>
          Re-route
        </button>
      </div>
    {/if}
    <div class="absolute bottom-4 inset-x-0 flex flex-col items-center">
      {#if showSettings}
        <div class="bg-base-100/90 backdrop-blur rounded-lg px-4 py-2 text-xs space-y-1.5">
          <div class="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <label class="flex items-center gap-1.5">
              <span class="opacity-60">Placement</span>
              <select
                class="select select-xs"
                value={placementApproach}
                onchange={(e) => onPlaceRouteApproachChange(e.currentTarget.value as PlaceRouteApproach)}
              >
                <option value="lns">LNS</option>
                <option value="greedy-route">Greedy + ACO</option>
                <option value="sa">SA</option>
                <option value="tabu">Tabu Search</option>
                <option value="lahc">LAHC</option>
                <option value="ils">ILS</option>
              </select>
            </label>
            <label class="flex items-center gap-1.5" title="Maximum jumper cables allowed (0 = all routes must be on one layer)">
              <span class="opacity-60">Max Jumpers</span>
              <input
                type="number"
                class="input input-xs w-14 text-right tabular-nums"
                value={allowedJumpers}
                min="0"
                oninput={(e) => onAllowedJumpersChange(Math.max(0, +e.currentTarget.value || 0))}
              />
            </label>
            <label class="flex items-center gap-1.5 cursor-pointer" title="Allow resistors to bend into L-shapes (free placement on both axes)">
              <span class="opacity-60">Flex Resistors</span>
              <input
                type="checkbox"
                class="toggle toggle-xs"
                checked={flexResistors}
                onchange={(e) => onFlexResistorsChange(e.currentTarget.checked)}
              />
            </label>
            <label class="flex items-center gap-1.5 cursor-pointer" title="Group identical parts next to each other on their longer side">
              <span class="opacity-60">Beauty</span>
              <input
                type="checkbox"
                class="toggle toggle-xs"
                checked={beautyFilter}
                onchange={(e) => onBeautyFilterChange(e.currentTarget.checked)}
              />
            </label>
          </div>
          <div class="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <span class="opacity-40 text-[10px]">Routing penalties — higher = avoided more</span>
          </div>
          <div class="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <label class="flex items-center gap-1.5" title="Wire changing direction (turning)">
              <span class="opacity-60">Bend</span>
              <input type="range" class="range range-xs w-20" min={0} max={500} step={5} value={bendCost} oninput={(e) => onBendCostChange(+e.currentTarget.value)} />
              <span class="w-10 tabular-nums text-right opacity-60">{bendCost}</span>
            </label>
            <label class="flex items-center gap-1.5" title="Each grid cell of wire length">
              <span class="opacity-60">Length</span>
              <input type="range" class="range range-xs w-20" min={0} max={2000} step={50} value={stepCost} oninput={(e) => onStepCostChange(+e.currentTarget.value)} />
              <span class="w-10 tabular-nums text-right opacity-60">{stepCost >= 1000 ? `${(stepCost / 1000).toFixed(0)}k` : stepCost}</span>
            </label>
          </div>
          <div class="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <span class="opacity-40 text-[10px]">Board size limit</span>
            <label class="flex items-center gap-1.5">
              <span class="opacity-60">W</span>
              <input
                type="number"
                class="input input-xs w-14 text-right tabular-nums"
                class:border-dashed={!maxBoardCols}
                class:opacity-50={!maxBoardCols}
                value={maxBoardCols || currentBoardCols}
                min={0}
                oninput={(e) => onMaxBoardColsChange(+e.currentTarget.value || 0)}
              />
            </label>
            <label class="flex items-center gap-1.5">
              <span class="opacity-60">H</span>
              <input
                type="number"
                class="input input-xs w-14 text-right tabular-nums"
                class:border-dashed={!maxBoardRows}
                class:opacity-50={!maxBoardRows}
                value={maxBoardRows || currentBoardRows}
                min={0}
                oninput={(e) => onMaxBoardRowsChange(+e.currentTarget.value || 0)}
              />
            </label>
            <label class="flex items-center gap-1.5" title="W+H sum — solver tries all splits and picks the best">
              <span class="opacity-60">W+H</span>
              <input
                type="number"
                class="input input-xs w-14 text-right tabular-nums"
                class:border-dashed={!maxBoardSum}
                class:opacity-50={!maxBoardSum}
                value={localSum}
                min={0}
                oninput={(e) => { localSum = e.currentTarget.value; onMaxBoardSumChange(+e.currentTarget.value || 0); }}
              />
            </label>
          </div>
        </div>
      {/if}
      <div class="flex items-center gap-2 mt-1">
        <button
          class="bg-base-100/90 backdrop-blur rounded-lg px-4 py-1.5 opacity-40 hover:opacity-100 transition-opacity"
          onclick={onResetAll}
          title="Reset all manual changes (positions, rotations)"
        >
          <IconMdiRestart class="w-5 h-5" />
        </button>
        <button
          class="bg-base-100/90 backdrop-blur rounded-lg px-4 py-1.5 opacity-40 hover:opacity-100 transition-opacity"
          onclick={onShuffle}
          title="Re-run placement from scratch with new random seed"
        >
          <IconMdiShuffle class="w-5 h-5" />
        </button>
        <button
          class="bg-base-100/90 backdrop-blur rounded-lg px-4 py-1.5 opacity-40 hover:opacity-100 transition-opacity"
          onclick={() => { showSettings = !showSettings; }}
          title="Routing settings"
        >
          <IconMdiCog class="w-5 h-5" />
        </button>
        <button
          class="bg-base-100/90 backdrop-blur rounded-lg px-4 py-1.5 opacity-40 hover:opacity-100 transition-opacity"
          onclick={() => { showBenchmark = true; }}
          title="Run parameter benchmark"
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M22,21H2V3H4V19H6V10H10V19H12V6H16V19H18V14H22V21Z"/></svg>
        </button>
      </div>
    </div>
  </Pane>

  <PaneResizer class="w-2 bg-accent-content hover:bg-accent cursor-col-resize transition-colors" />

  <Pane defaultSize={40} class="min-w-0 bg-base-200">
    <PartsList
      {parts}
      {footprintEditState}
      {onEditFootprint}
      {onFinishCurrentFootprint}
      {onCancelCurrentFootprint}
      {onEditMultipleFootprints}
      {onAddPart}
      {onUploadSpice}
    />
  </Pane>
</PaneGroup>

{#if showBenchmark}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm" onclick={(e) => { if (e.target === e.currentTarget) showBenchmark = false; }}>
    <div class="w-[92vw] max-w-6xl bg-base-100 rounded-xl shadow-2xl border border-base-300 overflow-hidden">
      <BenchmarkPanel
        {parts}
        {parsedKiCadDoc}
        {getFootprintInfo}
        maxJumpers={allowedJumpers}
        maxCols={maxBoardCols || undefined}
        maxRows={maxBoardRows || undefined}
        maxSum={maxBoardSum || undefined}
        onClose={() => { showBenchmark = false; }}
        onApplyResult={onApplyBenchmarkResult}
      />
    </div>
  </div>
{/if}
