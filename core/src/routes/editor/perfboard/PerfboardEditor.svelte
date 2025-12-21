<script lang="ts">
  import { browser } from "$app/environment";
  import { getNetworkForPin, initializeFromSpice } from "$lib/utils";
  import PerfboardOverview from "./PerfboardOverview.svelte";
  import PerfboardEditorOverlay from "./PerfboardEditorOverlay.svelte";
  import { initFootprintEditForPart, defaultBoardSize } from "./editorHelpers";
  import { computeDerivedState } from "./editorDerived";
  import { createEditorActions } from "./editorActions";
  import { createPinFlowActions } from "./pinFlowActions";
  import { cleanupSkippedPins, computeAutoBodies } from "./pinFlowHelpers";
  import type { 
    FootprintEditState,
    OnEditFootprintFunction,
    OnEditMultipleFootprintsFunction,
    ComponentBody,
    VariableFootprintSettings,
    Part,
    PinPosition 
  } from "$lib/types";

  let placedParts: App.PlacedPart[] = $state([]);
  let parts: Record<string, Part> = $state({});
  let parsedKiCadDoc: any = $state(null);

  let perfboardCols = $state(8);
  let perfboardRows = $state(8);
  let boardSizeManuallySet = $state(false);
  let selectedPins: PinPosition[] = $state([]);
  let componentBodies: ComponentBody[] = $state([]);
  let variableFootprintSettings: VariableFootprintSettings = $state({ minLength: 3, maxLength: 10 });
  let highlightedPin = $state(null as any);
  let forcedPinNumber = $state(null as string | number | null);
  let skippedPinNumbers: Array<string | number> = $state([]);
  let hideDisconnectedPins = $state(false);
  let autoBodyEnabled = $state(true);

  let footprintEditState: FootprintEditState = $state({
    partKeyQueue: [],
    currentFootprint: {
      name: "Default",
      layout: { type: "fixed", pins: [] },
    },
  });

  const derivedState = $derived.by(() =>
    computeDerivedState({
      parts,
      footprintEditState,
      selectedPins,
      skippedPinNumbers,
      forcedPinNumber,
      hideDisconnectedPins,
      parsedKiCadDoc,
      getNetworkForPin
    })
  );

  const isSamePinList = (left: Array<string | number>, right: Array<string | number>) => {
    if (left.length !== right.length) return false;
    return left.every((value, index) => value == right[index]);
  };

  const removeBody = (index: number) => {
    autoBodyEnabled = false;
    componentBodies = componentBodies.filter((item, i) => i !== index);
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
    setLayoutPins: (pins) => { footprintEditState.currentFootprint.layout.pins = pins; },
    getCurrentPartKey: () => derivedState.currentPartKey,
    getNextPinToPlace: () => derivedState.nextPinToPlace,
    getSelectedPins: () => selectedPins,
    setSelectedPins: (pins) => { selectedPins = pins; },
    setHighlightedPin: (pin) => { highlightedPin = pin; },
    getForcedPinNumber: () => forcedPinNumber,
    setForcedPinNumber: (value) => { forcedPinNumber = value; },
    setSkippedPinNumbers: (value) => { skippedPinNumbers = value; },
    getComponentBodies: () => componentBodies,
    setComponentBodies: (value) => { componentBodies = value; },
    setAutoBodyEnabled: (value) => { autoBodyEnabled = value; },
    getPerfboardCols: () => perfboardCols,
    getPerfboardRows: () => perfboardRows,
    getFilteredUnplacedPins: () => derivedState.filteredUnplacedPins,
    getVariableFootprintSettings: () => variableFootprintSettings,
    setVariableFootprintSettings: (value) => { variableFootprintSettings = value; },
    setLayout: (layout) => { footprintEditState.currentFootprint.layout = layout; }
  });

  const clearAllBodies = () => {
    autoBodyEnabled = false;
    componentBodies = [];
  };

  const setSelectedPins = (pins: PinPosition[]) => {
    selectedPins = pins;
    if (footprintEditState.currentFootprint.layout.type === "fixed") {
      footprintEditState.currentFootprint.layout.pins = selectedPins;
    }
  };

  const setComponentBodies = (bodies: ComponentBody[]) => {
    componentBodies = bodies;
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
    const nextBoardSize = resetEditingState();
    boardSizeManuallySet = nextBoardSize;
  };

  const onEditFootprint: OnEditFootprintFunction = (partKey: string) => {
    footprintEditState.partKeyQueue.push(partKey);
    applyReset();
    const initState = initFootprintEditForPart({
      part: parts[partKey] ?? null,
      variableFootprintSettings
    });
    footprintEditState.currentFootprint = initState.currentFootprint;
    selectedPins = initState.selectedPins;
    variableFootprintSettings = initState.variableFootprintSettings;
  };

  const { selectPinToPlace, skipNextPin, skipToNextConnectedPin } = createPinFlowActions({
    getCurrentPartKey: () => derivedState.currentPartKey,
    getCurrentPartPins: () => derivedState.currentPartPins,
    getNextPinToPlace: () => derivedState.nextPinToPlace,
    getHighlightedPin: () => highlightedPin,
    getForcedPinNumber: () => forcedPinNumber,
    getSkippedPinNumbers: () => skippedPinNumbers,
    getHideDisconnectedPins: () => hideDisconnectedPins,
    isConnectedPin: (pinNumber) => derivedState.isConnectedPin(pinNumber),
    setForcedPinNumber: (value) => { forcedPinNumber = value; },
    setSkippedPinNumbers: (value) => { skippedPinNumbers = value; },
    setHighlightedPin: (value) => { highlightedPin = value; }
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
    componentBodies = computeAutoBodies(selectedPins);
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
      const footprintToSave = { ...footprintEditState.currentFootprint };
      if (derivedState.isEditingSharedFootprint) {
        derivedState.partsWithSameFootprint.forEach(({ key }) => {
          if (parts[key]) {
            parts[key].footprint = { ...footprintToSave };
          }
        });
      } else {
        parts[derivedState.currentPartKey].footprint = footprintToSave;
      }
    }
    footprintEditState.partKeyQueue.shift();
    applyReset();
  };

  const onCancelCurrentFootprint = () => {
    footprintEditState.partKeyQueue.shift();
    resetEditingState();
  };

  const onEditMultipleFootprints: OnEditMultipleFootprintsFunction = (...partKeys: string[]) => {
    footprintEditState.partKeyQueue.push(...partKeys);
  };

  if (browser) {
    const spice = localStorage.getItem("uploadedSpice");
    const initialData = initializeFromSpice(spice);
    parts = initialData.parts;
    parsedKiCadDoc = initialData.parsedKiCadDoc;
    placedParts = initialData.placedParts;
  }

  const editorProps = $derived.by(() => ({
    perfboardCols,
    perfboardRows,
    variableFootprintSettings,
    highlightedPin,
    selectedPins,
    componentBodies,
    footprintEditState,
    parts,
    parsedKiCadDoc,
    availableFootprints: derivedState.availableFootprints,
    currentPart: derivedState.currentPart,
    currentPartPins: derivedState.currentPartPins,
    nextPinToPlace: derivedState.nextPinToPlace,
    allPinsPlaced: derivedState.allPinsPlaced,
    isEditingSharedFootprint: derivedState.isEditingSharedFootprint,
    partsWithSameFootprint: derivedState.partsWithSameFootprint,
    getNetworkForPin: (partKey: string, pinNumber: string | number) => getNetworkForPin(parts, partKey, pinNumber, parsedKiCadDoc),
    onCancel: onCancelCurrentFootprint,
    onFinish: onFinishCurrentFootprint,
    onColsChange: (cols: number) => {
      boardSizeManuallySet = true;
      perfboardCols = cols;
    },
    onRowsChange: (rows: number) => {
      boardSizeManuallySet = true;
      perfboardRows = rows;
    },
    onFootprintNameChange: (name: string) => {
      footprintEditState.currentFootprint.name = name;
    },
    onLoadExistingFootprint: loadExistingFootprint,
    onSwitchFootprintType: switchFootprintType,
    onClearAllPins: clearAllPins,
    onUpdatePinName: updatePinName,
    onRemovePin: removePin,
    onSetHighlightedPin: (pin: any) => highlightedPin = pin,
    onSetPins: setSelectedPins,
    onSetBodies: setComponentBodies,
    onSelectPinToPlace: selectPinToPlace,
    onSkipNextPin: skipNextPin,
    onSkipNextConnectedPin: skipToNextConnectedPin,
    hideDisconnectedPins,
    onToggleHideDisconnectedPins: () => hideDisconnectedPins = !hideDisconnectedPins,
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
    {placedParts}
  />
{:else}
  <PerfboardEditorOverlay {editorProps} />
{/if}
