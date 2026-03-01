<script lang="ts">
  import { KNOWN_FOOTPRINTS } from "xtoedif";
  import { getNetworkForPin, initializeFromSpice } from "$lib/utils";
  import PerfboardOverview from "./PerfboardOverview.svelte";
  import PerfboardEditorOverlay from "./PerfboardEditorOverlay.svelte";
  import { initFootprintEditForPart, defaultBoardSize } from "./editorHelpers";
  import { computeDerivedState } from "./editorDerived";
  import { createEditorActions } from "./editorActions";
  import { createPinFlowActions } from "./pinFlowActions";
  import { cleanupSkippedPins, computeAutoBodies } from "./pinFlowHelpers";
  import { DEFAULT_VARIABLE_FOOTPRINT_SETTINGS } from "./editorDefaults";
  import { computeSmartPlacements, type Rotation, type PlaceRouteApproach } from "./overviewPlacement";
  import { extractNets, type RatsnestLine, type StripCut, type RoutingResult } from "./routing";
  import { analyzePlanarity, type PlanarityResult } from "./planarity";
  import type {
    FootprintEditState,
    OnEditFootprintFunction,
    OnEditMultipleFootprintsFunction,
    ComponentBody,
    VariableFootprintSettings,
    Part,
    PinPosition,
    PinInfo
  } from "$lib/types";
  export type BoardType = "perfboard" | "stripboard";
  interface Props {
    boardType?: BoardType;
  }
  const { boardType = "perfboard" }: Props = $props();

  let placedParts: App.PlacedPart[] = $state([]);
  let parts: Record<string, Part> = $state({});
  let parsedKiCadDoc: any = $state(null);
  let perfboardCols = $state(8);
  let perfboardRows = $state(8);
  let boardSizeManuallySet = $state(false);
  let selectedPins: PinPosition[] = $state([]);
  let componentBodies: ComponentBody[] = $state([]);
  let variableFootprintSettings: VariableFootprintSettings = $state({ ...DEFAULT_VARIABLE_FOOTPRINT_SETTINGS });
  let highlightedPin: PinInfo | null = $state(null);
  let forcedPinNumber: string | number | null = $state(null);
  let skippedPinNumbers: Array<string | number> = $state([]);
  let hideDisconnectedPins = $state(true);
  let groupConnectedPins = $state(true);
  let autoBodyEnabled = $state(true);
  let footprintEditState: FootprintEditState = $state({
    partKeyQueue: [],
    currentFootprint: {
      name: "",
      layout: { type: "fixed", pins: [] },
    },
  });
  let activePartKey: string | null = $state(null);
  const resolveNetworkForPin = (partKey: string, pinNumber: string | number) => {
    return getNetworkForPin(parts, partKey, pinNumber, parsedKiCadDoc);
  };
  const setPins = (pins: PinPosition[]) => {
    selectedPins = pins;
    if (footprintEditState.currentFootprint.layout.type === "fixed") {
      footprintEditState.currentFootprint.layout.pins = pins;
    }
  };
  const setBodies = (bodies: ComponentBody[]) => {
    componentBodies = bodies;
  };
  const setManualBodies = (bodies: ComponentBody[]) => {
    autoBodyEnabled = false;
    componentBodies = bodies;
  };
  const setHighlighted = (pin: PinInfo | null) => {
    highlightedPin = pin;
  };
  const setForcedPin = (value: string | number | null) => {
    forcedPinNumber = value;
  };
  const setSkippedPins = (value: Array<string | number>) => {
    skippedPinNumbers = value;
  };
  const derivedState = $derived.by(() =>
    computeDerivedState({
      parts,
      footprintEditState,
      selectedPins,
      skippedPinNumbers,
      forcedPinNumber,
      hideDisconnectedPins,
      getNetworkForPin: resolveNetworkForPin
    })
  );
  const getPinsToPlace = () => {
    const nextPin = derivedState.nextPinToPlace;
    if (!nextPin) return [];
    if (!groupConnectedPins || !derivedState.currentPartKey) return [nextPin];
    const network = resolveNetworkForPin(derivedState.currentPartKey, nextPin.pinNumber);
    if (!network || network.netName === "No net" || network.netCode == null) return [nextPin];
    return derivedState.currentPartPins.filter(
      (pin) => pin.netCode === network.netCode && !pin.isPlaced
    );
  };
  const isSamePinList = (left: Array<string | number>, right: Array<string | number>) => {
    if (left.length !== right.length) return false;
    return left.every((value, index) => value == right[index]);
  };
  const removeBody = (index: number) => {
    setManualBodies(componentBodies.filter((item, i) => i !== index));
  };
  const {
    handlePadClick,
    handleBodyDrag,
    handlePinDrag,
    removePin,
    clearAllPins,
    updatePinName,
    switchFootprintType,
    loadExistingFootprint,
    resetEditingState
  } = createEditorActions({
    getLayoutType: () => footprintEditState.currentFootprint.layout.type,
    getCurrentPartKey: () => derivedState.currentPartKey,
    getPinsToPlace,
    getSelectedPins: () => selectedPins,
    setPins,
    setHighlightedPin: setHighlighted,
    getForcedPinNumber: () => forcedPinNumber,
    setForcedPinNumber: setForcedPin,
    setSkippedPinNumbers: setSkippedPins,
    getComponentBodies: () => componentBodies,
    setComponentBodies: setBodies,
    setAutoBodyEnabled: (value) => { autoBodyEnabled = value; },
    getPerfboardCols: () => perfboardCols,
    getPerfboardRows: () => perfboardRows,
    getFilteredUnplacedPins: () => derivedState.filteredUnplacedPins,
    getGroupConnectedPins: () => groupConnectedPins,
    getNetworkForPin: resolveNetworkForPin,
    getVariableFootprintSettings: () => variableFootprintSettings,
    setVariableFootprintSettings: (value) => { variableFootprintSettings = value; },
    setLayout: (layout) => { footprintEditState.currentFootprint.layout = layout; }
  });
  const clearAllBodies = () => {
    setManualBodies([]);
  };
  $effect(() => {
    if (footprintEditState.currentFootprint.layout.type === "variable") {
      footprintEditState.currentFootprint.layout.minLength = variableFootprintSettings.minLength;
      footprintEditState.currentFootprint.layout.maxLength = variableFootprintSettings.maxLength;
    }
  });
  $effect(() => {
    if (!derivedState.currentPartKey || boardSizeManuallySet) return;
    const pinCount = derivedState.currentPartPins.length;
    if (pinCount > 0) {
      const size = defaultBoardSize(pinCount);
      perfboardCols = size;
      perfboardRows = size;
    }
  });
  const applyReset = () => {
    resetEditingState();
    boardSizeManuallySet = false;
  };
  const setBoardCols = (cols: number) => {
    boardSizeManuallySet = true;
    perfboardCols = cols;
  };
  const setBoardRows = (rows: number) => {
    boardSizeManuallySet = true;
    perfboardRows = rows;
  };
  const toggleHideDisconnectedPins = () => {
    hideDisconnectedPins = !hideDisconnectedPins;
  };
  const toggleGroupConnectedPins = () => {
    groupConnectedPins = !groupConnectedPins;
  };
  const queueFootprintEdits = (...partKeys: string[]) => {
    footprintEditState.partKeyQueue = [...partKeys];
  };
  const onEditFootprint: OnEditFootprintFunction = (partKey: string) => {
    queueFootprintEdits(partKey);
  };
  $effect(() => {
    const nextKey = footprintEditState.partKeyQueue[0] ?? null;
    if (!nextKey || nextKey === activePartKey) return;
    activePartKey = nextKey;
    applyReset();
    const initState = initFootprintEditForPart({
      part: parts[nextKey] ?? null,
      defaultFootprints: Object.values(KNOWN_FOOTPRINTS),
      variableFootprintSettings
    });
    footprintEditState.currentFootprint = initState.currentFootprint;
    setPins(initState.selectedPins);
    variableFootprintSettings = initState.variableFootprintSettings;
  });
  const { selectPinToPlace, skipNextPin, skipToNextConnectedPin } = createPinFlowActions({
    getCurrentPartKey: () => derivedState.currentPartKey,
    getCurrentPartPins: () => derivedState.currentPartPins,
    getNextPinToPlace: () => derivedState.nextPinToPlace,
    getHighlightedPin: () => highlightedPin,
    getForcedPinNumber: () => forcedPinNumber,
    getSkippedPinNumbers: () => skippedPinNumbers,
    getHideDisconnectedPins: () => hideDisconnectedPins,
    isConnectedPin: (pinNumber) => derivedState.isConnectedPin(pinNumber),
    setForcedPinNumber: setForcedPin,
    setSkippedPinNumbers: setSkippedPins,
    setHighlightedPin: setHighlighted
  });
  $effect(() => {
    if (footprintEditState.currentFootprint.layout.type !== "fixed") return;
    if (!derivedState.currentPartKey || !derivedState.nextPinToPlace) {
      highlightedPin = null;
      return;
    }
    if (highlightedPin?.pinNumber !== derivedState.nextPinToPlace.pinNumber) {
      highlightedPin = { partKey: derivedState.currentPartKey, pinNumber: derivedState.nextPinToPlace.pinNumber };
    }
  });
  $effect(() => {
    if (!hideDisconnectedPins || forcedPinNumber == null) return;
    if (!derivedState.isConnectedPin(forcedPinNumber)) {
      forcedPinNumber = null;
    }
  });
  $effect(() => {
    if (!autoBodyEnabled) return;
    setBodies(computeAutoBodies(selectedPins));
  });
  $effect(() => {
    if (selectedPins.length === 0) return;
    const cleaned = cleanupSkippedPins({ selectedPins, skippedPinNumbers, forcedPinNumber });
    if (!isSamePinList(cleaned.skippedPinNumbers, skippedPinNumbers)) {
      skippedPinNumbers = cleaned.skippedPinNumbers;
    }
    if (cleaned.forcedPinNumber !== forcedPinNumber) {
      forcedPinNumber = cleaned.forcedPinNumber;
    }
  });
  const onFinishCurrentFootprint = () => {
    if (derivedState.currentPartKey && parts[derivedState.currentPartKey]) {
      const part = parts[derivedState.currentPartKey];
      const footprintToSave = { ...footprintEditState.currentFootprint };
      // For scratch parts, populate pins from placed pins
      if (!part.pins || part.pins.length === 0) {
        part.pins = selectedPins.map(p => ({
          pinNumber: p.pinNumber,
          name: p.name || `${p.pinNumber}`,
        }));
        part.pinCount = selectedPins.length;
      }
      if (derivedState.isEditingSharedFootprint) {
        derivedState.partsWithSameFootprint.forEach(({ key }) => {
          if (parts[key]) {
            parts[key].footprint = { ...footprintToSave };
          }
        });
      } else {
        part.footprint = footprintToSave;
      }
      parts = { ...parts };
    }
    footprintEditState.partKeyQueue.shift();
    applyReset();
  };
  const onCancelCurrentFootprint = () => {
    // Remove scratch parts that were never completed
    const cancelledKey = footprintEditState.partKeyQueue[0];
    if (cancelledKey && parts[cancelledKey] && (!parts[cancelledKey].pins || parts[cancelledKey].pins.length === 0) && !parts[cancelledKey].footprint) {
      delete parts[cancelledKey];
      parts = { ...parts };
    }
    footprintEditState.partKeyQueue.shift();
    resetEditingState();
  };
  const onEditMultipleFootprints: OnEditMultipleFootprintsFunction = (...partKeys: string[]) => {
    queueFootprintEdits(...partKeys);
  };

  let newPartCounter = $state(1);
  const onAddPart = () => {
    const key = `Part${newPartCounter}`;
    newPartCounter++;
    parts[key] = {
      comp: { footprint: "", fields: [], properties: [] },
      name: key,
      description: "",
      netRefs: [],
      pinCount: 0,
      pins: [],
    };
    parts = { ...parts };
    queueFootprintEdits(key);
  };
  const onUploadSpice = (spiceContent: string) => {
    const data = initializeFromSpice(spiceContent);
    if (Object.keys(data.parts).length === 0) return;
    // Merge new parts into existing, skip duplicates by key
    const merged = { ...parts };
    for (const [key, part] of Object.entries(data.parts)) {
      if (!merged[key]) {
        merged[key] = part;
      }
    }
    parts = merged;
    parsedKiCadDoc = data.parsedKiCadDoc;
    placedParts = [...placedParts, ...data.placedParts];
  };

  // Overview board placement
  let manualPositions: Record<string, { x: number; y: number }> = $state({});
  let partRotations: Record<string, Rotation> = $state({});
  let maxBoardCols = $state(0); // 0 = no limit
  let maxBoardRows = $state(0);
  let maxBoardSum = $state(0); // 0 = no limit; W+H constraint
  let placementGeneration = $state(0); // bump to force recompute
  let routingStale = $state(false); // true when manual edits haven't been routed yet

  // Placement approach — LNS is the benchmark winner (cost=598 vs ACO-ACS=823)
  let placementApproach: PlaceRouteApproach = $state("lns");

  // Routing costs — declared before overviewLayout which depends on them
  const pinCost = 20500; // Always forbidden — routes must never cross other parts' pins
  const routeCost = 20001; // Always forbidden — crossings require jumpers
  let bendCost = $state(50);
  let stepCost = $state(50);

  // Allowed jumper cables — 0 by default (all routes must be on layer 1)
  let allowedJumpers: number = $state(0);

  // Flexible resistor placement — allow L-shapes for 2-pin variable footprints
  let flexResistors: boolean = $state(false);

  // Beauty filter — group same-type parts on their longer side
  let beautyFilter: boolean = $state(false);

  // Get footprint dimensions for a part
  const getFootprintInfo = (part: Part) => {
    const footprint = part.footprint;
    if (!footprint) return null;
    let pins: PinPosition[] = [];
    let w = 1;
    let h = 1;

    if (footprint.layout.type === "fixed" && footprint.layout.pins.length > 0) {
      pins = footprint.layout.pins;
      w = footprint.layout.width ?? Math.max(...pins.map(p => p.x)) + 1;
      h = footprint.layout.height ?? Math.max(...pins.map(p => p.y)) + 1;
    } else if (footprint.layout.type === "variable") {
      const len = footprint.layout.minLength ?? 4;
      pins = [
        { x: 0, y: 0, pinNumber: 1, name: "1" },
        { x: len - 1, y: 0, pinNumber: 2, name: "2" }
      ];
      w = len;
      h = 1;
    }
    return pins.length > 0 ? { pins, w, h } : null;
  };

  // Smart net-aware auto-placement — uses rAF to yield to browser before blocking compute
  let overviewLayout: import("./overviewPlacement").PlacementResult = $state({
    placements: [], boardCols: 0, boardRows: 0, rotations: {},
  });
  let isGenerating = $state(false);
  $effect(() => {
    // Only react to structural changes — settings, positions, and rotations
    // are read inside the rAF so they don't trigger auto-recompute
    void placementGeneration;
    const _parts = parts;
    const _doc = parsedKiCadDoc;
    const _boardType = boardType;

    isGenerating = true;
    const rafId = requestAnimationFrame(() => {
      // Read everything else here (not tracked by $effect)
      overviewLayout = computeSmartPlacements({
        parts: _parts,
        parsedKiCadDoc: _doc,
        manualPositions,
        getFootprintInfo,
        rotations: partRotations,
        routingCosts: { stepCost, bendCost, pinCost, routeCost },
        approach: placementApproach,
        maxCols: maxBoardCols || undefined,
        maxRows: maxBoardRows || undefined,
        maxSum: maxBoardSum || undefined,
        maxJumpers: allowedJumpers,
        timeoutMs: 10_000,
        flexResistors,
        beautyFilter,
        boardType: _boardType,
      });
      isGenerating = false;
      routingStale = false;
    });
    return () => cancelAnimationFrame(rafId);
  });

  // Track which parts the user explicitly dragged/rotated
  let userMovedParts: Set<string> = $state(new Set());

  const onPartMove = (partKey: string, newX: number, newY: number) => {
    manualPositions = { ...manualPositions, [partKey]: { x: newX, y: newY } };
    userMovedParts = new Set([...userMovedParts, partKey]);
    routingStale = true;
  };

  // Show re-route button when routing is out of date with manual edits
  const hasManualChanges = $derived(routingStale);

  const onReroute = () => {
    // Trigger recompute with current manual positions
    placementGeneration++;
  };
  const onShuffle = () => {
    // Clear everything and re-run with a fresh random seed
    manualPositions = {};
    userMovedParts = new Set();
    partRotations = {};
    placementGeneration++;
  };
  const onResetAll = () => {
    // Clear all user changes and recompute
    manualPositions = {};
    userMovedParts = new Set();
    partRotations = {};
    placementGeneration++;
  };
  const onUnfixPart = (partKey: string) => {
    const newManual = { ...manualPositions };
    delete newManual[partKey];
    manualPositions = newManual;
    const newFixed = new Set(userMovedParts);
    newFixed.delete(partKey);
    userMovedParts = newFixed;
    const newRot = { ...partRotations };
    delete newRot[partKey];
    partRotations = newRot;
    // Recompute to let the algorithm re-place this part
    placementGeneration++;
  };

  const onRotatePart = (partKey: string) => {
    const current = partRotations[partKey] ?? overviewLayout.rotations[partKey] ?? 0;
    const next = ((current + 1) % 4) as Rotation;
    partRotations = { ...partRotations, [partKey]: next };
    userMovedParts = new Set([...userMovedParts, partKey]);
    routingStale = true;
  };

  // Display placements: merge algorithm result with manual position/rotation overrides
  // (so dragged/rotated parts show correctly without recomputing)
  const rotateFn = (x: number, y: number, w: number, h: number, rot: number) => {
    switch (rot) {
      case 1: return { x: h - 1 - y, y: x };
      case 2: return { x: w - 1 - x, y: h - 1 - y };
      case 3: return { x: y, y: w - 1 - x };
      default: return { x, y };
    }
  };
  const displayPlacements = $derived.by(() => {
    return overviewLayout.placements.map(p => {
      const manual = manualPositions[p.partKey];
      const userRot = partRotations[p.partKey];
      const algRot = overviewLayout.rotations[p.partKey] ?? 0;
      const needsReposition = manual != null && (manual.x !== p.offsetX || manual.y !== p.offsetY);
      const needsRotation = userRot !== undefined && userRot !== algRot;

      if (!needsReposition && !needsRotation) return p;

      const newOffsetX = manual?.x ?? p.offsetX;
      const newOffsetY = manual?.y ?? p.offsetY;

      if (!needsRotation) {
        // Position change only — shift pins
        const dx = newOffsetX - p.offsetX;
        const dy = newOffsetY - p.offsetY;
        return { ...p, offsetX: newOffsetX, offsetY: newOffsetY, pins: p.pins.map(pin => ({ ...pin, x: pin.x + dx, y: pin.y + dy })) };
      }

      // Rotation change (possibly with position change too)
      const inverseAlg = [0, 3, 2, 1][algRot] as Rotation;
      const origW = (algRot % 2 === 1) ? p.height : p.width;
      const origH = (algRot % 2 === 1) ? p.width : p.height;
      const newW = (userRot % 2 === 1) ? origH : origW;
      const newH = (userRot % 2 === 1) ? origW : origH;

      const newPins = p.pins.map(pin => {
        const orig = rotateFn(pin.x - p.offsetX, pin.y - p.offsetY, p.width, p.height, inverseAlg);
        const rotated = rotateFn(orig.x, orig.y, origW, origH, userRot);
        return { ...pin, x: newOffsetX + rotated.x, y: newOffsetY + rotated.y };
      });

      return { ...p, offsetX: newOffsetX, offsetY: newOffsetY, width: newW, height: newH, pins: newPins };
    });
  });

  const overviewPins = $derived(displayPlacements.flatMap(p => p.pins));

  // Extract nets once (shared by planarity + routing)
  const overviewNets = $derived.by(() => {
    const placements = overviewLayout.placements;
    if (placements.length === 0) return [];
    return extractNets(placements, parts, parsedKiCadDoc);
  });

  // Planarity analysis — computed before routing to inform UI and cap jumper count
  const planarityInfo = $derived.by((): PlanarityResult => {
    if (overviewNets.length === 0) return { isPlanar: true, minJumperWires: 0, totalEdges: 0, totalVertices: 0 };
    return analyzePlanarity(overviewNets);
  });

  // Board dimensions: grow if manual moves push parts outside algorithm's board
  const overviewBoardCols = $derived.by(() => {
    let cols = overviewLayout.boardCols;
    for (const p of displayPlacements) {
      cols = Math.max(cols, p.offsetX + p.width);
    }
    return cols;
  });
  const overviewBoardRows = $derived.by(() => {
    let rows = overviewLayout.boardRows;
    for (const p of displayPlacements) {
      rows = Math.max(rows, p.offsetY + p.height);
    }
    return rows;
  });

  const routingResult = $derived.by((): RoutingResult => {
    if (overviewLayout.routing) return overviewLayout.routing;
    // Fallback for edge cases (no placements, etc.)
    return { lines: [], totalCost: 0, failedCount: 0, bends: 0, crossings: 0, directConnections: 0, stripCuts: [] };
  });
  const ratsnestLines = $derived(routingResult.lines);
  const stripCuts = $derived(routingResult.stripCuts ?? []);

  // Check max constraints against actual board size
  const placementError = $derived.by(() => {
    const cols = overviewBoardCols;
    const rows = overviewBoardRows;
    const errors: string[] = [];
    if (maxBoardCols > 0 && cols > maxBoardCols) {
      errors.push(`Width ${cols} exceeds max ${maxBoardCols}`);
    }
    if (maxBoardRows > 0 && rows > maxBoardRows) {
      errors.push(`Height ${rows} exceeds max ${maxBoardRows}`);
    }
    if (maxBoardSum > 0 && (cols + rows) > maxBoardSum) {
      errors.push(`W+H = ${cols + rows} exceeds limit ${maxBoardSum} — not solvable`);
    }
    const failedRoutes = ratsnestLines.filter(l => l.failed).length;
    if (failedRoutes > 0) {
      errors.push(`${failedRoutes} route${failedRoutes > 1 ? 's' : ''} could not be resolved`);
    }
    return errors.length > 0 ? errors.join("; ") : undefined;
  });

  const editorProps = $derived.by(() => ({
    perfboardCols,
    perfboardRows,
    variableFootprintSettings,
    highlightedPin,
    selectedPins,
    componentBodies,
    footprintEditState,
    parts,
    availableFootprints: derivedState.availableFootprints,
    currentPart: derivedState.currentPart,
    currentPartPins: derivedState.currentPartPins,
    nextPinToPlace: derivedState.nextPinToPlace,
    allPinsPlaced: derivedState.allPinsPlaced,
    isEditingSharedFootprint: derivedState.isEditingSharedFootprint,
    partsWithSameFootprint: derivedState.partsWithSameFootprint,
    getNetworkForPin: resolveNetworkForPin,
    onCancel: onCancelCurrentFootprint,
    onFinish: onFinishCurrentFootprint,
    onColsChange: setBoardCols,
    onRowsChange: setBoardRows,
    onPartNameChange: (name: string) => {
      const key = derivedState.currentPartKey;
      if (key && parts[key]) {
        parts[key].name = name;
        parts = { ...parts };
      }
    },
    onFootprintNameChange: (name: string) => {
      footprintEditState.currentFootprint.name = name;
    },
    onLoadExistingFootprint: (name: string) => {
      const loaded = loadExistingFootprint(name, parts, Object.values(KNOWN_FOOTPRINTS));
      if (loaded) footprintEditState.currentFootprint = loaded;
    },
    onSwitchFootprintType: switchFootprintType,
    onClearAllPins: clearAllPins,
    onUpdatePinName: updatePinName,
    onRemovePin: removePin,
    onSetHighlightedPin: setHighlighted,
    onSetPins: setPins,
    onSetBodies: setBodies,
    onSelectPinToPlace: selectPinToPlace,
    onSkipNextPin: skipNextPin,
    onSkipNextConnectedPin: skipToNextConnectedPin,
    hideDisconnectedPins,
    onToggleHideDisconnectedPins: toggleHideDisconnectedPins,
    groupConnectedPins,
    onToggleGroupConnectedPins: toggleGroupConnectedPins,
    onClearAllBodies: clearAllBodies,
    onRemoveBody: removeBody,
    handlePadClick,
    handleBodyDrag,
    handlePinDrag
  }));
</script>

{#if footprintEditState.partKeyQueue.length === 0}
  <PerfboardOverview
    {parts}
    {footprintEditState}
    {onEditFootprint}
    {onFinishCurrentFootprint}
    {onCancelCurrentFootprint}
    {onEditMultipleFootprints}
    {onAddPart}
    {onUploadSpice}
    {placedParts}
    overviewPins={overviewPins}
    overviewBoardCols={overviewBoardCols}
    overviewBoardRows={overviewBoardRows}
    overviewPlacements={displayPlacements}
    {ratsnestLines}
    {isGenerating}
    fixedPartKeys={userMovedParts}
    {onPartMove}
    {onRotatePart}
    {hasManualChanges}
    {onReroute}
    {onShuffle}
    {onResetAll}
    {onUnfixPart}
    {bendCost}
    {stepCost}
    onBendCostChange={(v) => { bendCost = v; routingStale = true; }}
    onStepCostChange={(v) => { stepCost = v; routingStale = true; }}
    {maxBoardCols}
    {maxBoardRows}
    {maxBoardSum}
    currentBoardCols={overviewBoardCols}
    currentBoardRows={overviewBoardRows}
    onMaxBoardColsChange={(v) => { maxBoardCols = v; routingStale = true; }}
    onMaxBoardRowsChange={(v) => { maxBoardRows = v; routingStale = true; }}
    onMaxBoardSumChange={(v) => { maxBoardSum = v; routingStale = true; }}
    {placementError}
    {planarityInfo}
    {allowedJumpers}
    onAllowedJumpersChange={(v) => { allowedJumpers = v; routingStale = true; }}
    {placementApproach}
    onPlaceRouteApproachChange={(v) => { placementApproach = v; routingStale = true; }}
    {flexResistors}
    onFlexResistorsChange={(v) => { flexResistors = v; routingStale = true; }}
    {beautyFilter}
    onBeautyFilterChange={(v) => { beautyFilter = v; routingStale = true; }}
    {boardType}
    {stripCuts}
    {parsedKiCadDoc}
    {getFootprintInfo}
    onApplyBenchmarkResult={(result) => {
      overviewLayout = result;
      manualPositions = {};
      partRotations = {};
      routingStale = false;
    }}
  />
{:else}
  <PerfboardEditorOverlay {editorProps} />
{/if}
