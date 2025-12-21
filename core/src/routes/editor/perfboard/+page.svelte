<script lang="ts">
  import { browser } from "$app/environment";
  import { PerfBoard, PartsList, FootprintEditorView } from "$lib/components";
  import { getNetworkForPin, getCurrentPartPins, initializeFromSpice } from "$lib/utils";
  import { DEFAULT_FOOTPRINTS } from "xtoedif";
  import { PaneGroup, Pane, PaneResizer } from "paneforge";
  import type { 
    FootprintEditState,
    OnEditFootprintFunction,
    OnEditMultipleFootprintsFunction,
    ComponentBody,
    VariableFootprintSettings,
    Part,
    PinPosition 
  } from "$lib/types";

  // Main application state
  let placedParts: App.PlacedPart[] = $state([]);
  let parts: Record<string, Part> = $state({});
  let footprintNamesToEdit: string[] = $state([]);
  let parsedKiCadDoc: any = $state(null);

  // Footprint editor state
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

  let availableFootprints = $derived.by(() => {
    const unique = new Set<string>();
    Object.values(parts).forEach(part => {
      if (part.footprint?.name) {
        unique.add(part.footprint.name);
      }
    });
    Object.values(DEFAULT_FOOTPRINTS).forEach(footprint => {
      if (footprint?.name) {
        unique.add(footprint.name);
      }
    });
    return Array.from(unique).sort();
  });

  let partsWithSameFootprint = $derived.by(() => {
    const currentFootprintName = footprintEditState.currentFootprint.name;
    if (!currentFootprintName) return [];
    
    return Object.entries(parts)
      .filter(([, part]) => part.footprint?.name === currentFootprintName)
      .map(([key, part]) => ({ key, part }));
  });

  let isEditingSharedFootprint = $derived(partsWithSameFootprint.length > 1);

  const removeBody = (index: number) => {
    autoBodyEnabled = false;
    componentBodies = componentBodies.filter((item, i) => i !== index);
  };

  let currentPartKey = $derived(footprintEditState.partKeyQueue[0] ?? null);

  let currentPart = $derived.by(() => {
    return currentPartKey ? parts[currentPartKey] : null;
  });

  const getPinNetwork = (pinNumber: string | number) => {
    if (!currentPartKey) return null;
    return getNetworkForPin(parts, currentPartKey, pinNumber, parsedKiCadDoc);
  };

  const isConnectedPin = (pinNumber: string | number) => {
    const network = getPinNetwork(pinNumber);
    return !!network && network.netName !== "No net";
  };

  let basePartPins = $derived.by(() => {
    if (!currentPartKey) return [];
    return getCurrentPartPins(parts, currentPartKey, selectedPins);
  });

  let currentPartPins = $derived.by(() => {
    return basePartPins.map((pin) => {
      const isSkipped = skippedPinNumbers.some((p) => p == pin.pinNumber);
      return {
        ...pin,
        isSkipped,
        isPlaced: pin.isPlaced || isSkipped
      };
    });
  });

  let unplacedPins = $derived.by(() => currentPartPins.filter((pin) => !pin.isPlaced));
  let filteredUnplacedPins = $derived.by(() => {
    if (!hideDisconnectedPins) return unplacedPins;
    return unplacedPins.filter((pin) => isConnectedPin(pin.pinNumber));
  });

  let nextPinToPlace = $derived.by(() => {
    if (filteredUnplacedPins.length === 0) return null;

    if (forcedPinNumber != null) {
      const forcedPin = filteredUnplacedPins.find(p => p.pinNumber == forcedPinNumber);
      if (forcedPin) return forcedPin;
    }

    return filteredUnplacedPins[0];
  });

  $effect(() => {
    if (footprintEditState.currentFootprint.layout.type !== "fixed") return;
    if (!currentPartKey || !nextPinToPlace) {
      highlightedPin = null;
      return;
    }
    if (highlightedPin?.pinNumber !== nextPinToPlace.pinNumber) {
      highlightedPin = { partKey: currentPartKey, pinNumber: nextPinToPlace.pinNumber };
    }
  });

  $effect(() => {
    if (!hideDisconnectedPins || forcedPinNumber == null) return;
    if (!isConnectedPin(forcedPinNumber)) {
      forcedPinNumber = null;
    }
  });

  let allPinsPlaced = $derived.by(() => {
    if (currentPartPins.length === 0) return false;
    const relevantPins = currentPartPins.filter((pin) => isConnectedPin(pin.pinNumber));
    if (relevantPins.length === 0) return true;
    return relevantPins.every(pin => pin.isPlaced);
  });

  const handlePadClick = (x: number, y: number) => {
    if (footprintEditState.currentFootprint.layout.type === "fixed") {
      if (!currentPartKey) return;
      const existingIndex = selectedPins.findIndex(pin => pin.x === x && pin.y === y);
      if (existingIndex >= 0) {
        const existingPin = selectedPins[existingIndex];
        highlightedPin = { partKey: currentPartKey, pinNumber: existingPin.pinNumber };
      } else {
        const unplacedPin = nextPinToPlace;
        if (unplacedPin) {
          selectedPins = [...selectedPins, { 
            x, 
            y, 
            pinNumber: unplacedPin.pinNumber,
            name: unplacedPin.name
          }];
          highlightedPin = null;
          if (forcedPinNumber != null && unplacedPin.pinNumber == forcedPinNumber) {
            forcedPinNumber = null;
          }
        }
      }
      if (footprintEditState.currentFootprint.layout.type === "fixed") {
        footprintEditState.currentFootprint.layout.pins = selectedPins;
      }
    }
  };

  const handleBodyDrag = (x: number, y: number, width: number, height: number) => {
    if (width > 1 || height > 1) {
      autoBodyEnabled = false;
      const newBody = { x, y, width, height };
      componentBodies = [...componentBodies, newBody];
    }
  };

  const handlePinDrag = (x: number, y: number, width: number, height: number) => {
    const newPins: typeof selectedPins = [];
    const remainingPins = filteredUnplacedPins.length;
    
    for (let rowI = y; rowI < y + height && newPins.length < remainingPins; rowI++) {
      for (let colI = x; colI < x + width && newPins.length < remainingPins; colI++) {
        if (colI < perfboardCols && rowI < perfboardRows) {
          const exists = selectedPins.some(pin => pin.x === colI && pin.y === rowI);
          if (!exists) {
            const unplacedPin = filteredUnplacedPins.find(p => !newPins.some(np => np.pinNumber === p.pinNumber));
            if (unplacedPin) {
              newPins.push({
                x: colI,
                y: rowI,
                pinNumber: unplacedPin.pinNumber,
                name: unplacedPin.name
              });
            }
          }
        }
      }
    }
    
    selectedPins = [...selectedPins, ...newPins];
    if (forcedPinNumber != null && newPins.some(pin => pin.pinNumber == forcedPinNumber)) {
      forcedPinNumber = null;
    }
    if (footprintEditState.currentFootprint.layout.type === "fixed") {
      footprintEditState.currentFootprint.layout.pins = selectedPins;
    }
  };

  const removePin = (index: number) => {
    selectedPins = selectedPins.filter((item, i) => i !== index);
    if (footprintEditState.currentFootprint.layout.type === "fixed") {
      footprintEditState.currentFootprint.layout.pins = selectedPins;
    }
  };

  const clearAllPins = () => {
    selectedPins = [];
    forcedPinNumber = null;
    skippedPinNumbers = [];
    if (footprintEditState.currentFootprint.layout.type === "fixed") {
      footprintEditState.currentFootprint.layout.pins = [];
    }
  };

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

  const updatePinName = (index: number, newName: string) => {
    selectedPins = selectedPins.map((pin, i) => 
      i === index ? { ...pin, name: newName || "Pin" + pin.pinNumber } : pin
    );
    if (footprintEditState.currentFootprint.layout.type === "fixed") {
      footprintEditState.currentFootprint.layout.pins = selectedPins;
    }
  };

  const switchFootprintType = (type: "fixed" | "variable") => {
    if (type === "fixed") {
      footprintEditState.currentFootprint.layout = {
        type: "fixed",
        pins: selectedPins
      };
    } else {
      selectedPins = [];
      componentBodies = [];
      forcedPinNumber = null;
      skippedPinNumbers = [];
      
      footprintEditState.currentFootprint.layout = {
        type: "variable",
        minLength: variableFootprintSettings.minLength,
        maxLength: variableFootprintSettings.maxLength
      };
    }
  };

  const loadExistingFootprint = (footprintName: string) => {
    const partWithFootprint = Object.values(parts).find(part => 
      part.footprint?.name === footprintName
    );
    
    if (partWithFootprint?.footprint) {
      footprintEditState.currentFootprint = { ...partWithFootprint.footprint };
      if (partWithFootprint.footprint.layout.type === "fixed") {
        selectedPins = [...partWithFootprint.footprint.layout.pins];
      } else {
        variableFootprintSettings.minLength = partWithFootprint.footprint.layout.minLength || 3;
        variableFootprintSettings.maxLength = partWithFootprint.footprint.layout.maxLength || 10;
      }
    } else {
      const defaultFootprint = Object.values(DEFAULT_FOOTPRINTS).find(fp => fp?.name === footprintName);
      if (defaultFootprint) {
        footprintEditState.currentFootprint = { ...defaultFootprint };
        if (defaultFootprint.layout.type === "fixed") {
          selectedPins = [...defaultFootprint.layout.pins];
        } else {
          variableFootprintSettings.minLength = defaultFootprint.layout.minLength || 3;
          variableFootprintSettings.maxLength = defaultFootprint.layout.maxLength || 10;
        }
      }
    }
  };

  $effect(() => {
    if (footprintEditState.currentFootprint.layout.type === "variable") {
      footprintEditState.currentFootprint.layout.minLength = variableFootprintSettings.minLength;
      footprintEditState.currentFootprint.layout.maxLength = variableFootprintSettings.maxLength;
    }
  });

  $effect(() => {
    if (footprintEditState.partKeyQueue.length === 0 || boardSizeManuallySet) return;
    const pinCount = currentPartPins?.length || 0;
    if (pinCount > 0) {
      const size = Math.ceil(pinCount / 2) + 1;
      perfboardCols = size;
      perfboardRows = size;
    }
  });

  const onEditFootprint: OnEditFootprintFunction = (partKey: string) => {
    footprintEditState.partKeyQueue.push(partKey);
    resetEditingState();
    const currentPart = parts[partKey];
    if (currentPart?.footprint) {
      footprintEditState.currentFootprint = { ...currentPart.footprint };
      if (currentPart.footprint.layout.type === "fixed") {
        selectedPins = [...currentPart.footprint.layout.pins];
      } else {
        variableFootprintSettings.minLength = currentPart.footprint.layout.minLength || 3;
        variableFootprintSettings.maxLength = currentPart.footprint.layout.maxLength || 10;
      }
    } else {
      footprintEditState.currentFootprint = {
        name: (currentPart?.name || "Unknown") + " Footprint",
        layout: { type: "fixed", pins: [] },
      };
    }
  };

  const resetEditingState = () => {
    selectedPins = [];
    componentBodies = [];
    variableFootprintSettings = { minLength: 3, maxLength: 10 };
    highlightedPin = null;
    boardSizeManuallySet = false;
    forcedPinNumber = null;
    skippedPinNumbers = [];
    autoBodyEnabled = true;
  };

  const markSkippedPin = (pinNumber: string | number) => {
    if (skippedPinNumbers.some(p => p == pinNumber)) return;
    skippedPinNumbers = [...skippedPinNumbers, pinNumber];
  };

  const setFocusedPin = (pin: (typeof currentPartPins)[number] | null) => {
    if (pin && currentPartKey) {
      forcedPinNumber = pin.pinNumber;
      highlightedPin = { partKey: currentPartKey, pinNumber: pin.pinNumber };
    } else {
      forcedPinNumber = null;
      highlightedPin = null;
    }
  };

  const findNextUnplacedPin = (
    afterPinNumber: string | number,
    predicate: (pin: (typeof currentPartPins)[number]) => boolean = () => true
  ) => {
    const startIndex = currentPartPins.findIndex((pin) => pin.pinNumber == afterPinNumber);
    const afterList = startIndex >= 0 ? currentPartPins.slice(startIndex + 1) : currentPartPins;
    return (
      afterList.find((pin) => !pin.isPlaced && predicate(pin)) ??
      currentPartPins.find((pin) => !pin.isPlaced && predicate(pin)) ??
      null
    );
  };

  const selectPinToPlace = (pinNumber: string | number) => {
    if (!currentPartKey) return;
    if (hideDisconnectedPins && !isConnectedPin(pinNumber)) return;
    forcedPinNumber = pinNumber;
    skippedPinNumbers = skippedPinNumbers.filter(p => p != pinNumber);
    highlightedPin = { partKey: currentPartKey, pinNumber };
  };

  const skipNextPin = () => {
    const pinNumber = highlightedPin?.pinNumber ?? nextPinToPlace?.pinNumber;
    if (pinNumber == null) return;
    markSkippedPin(pinNumber);
    if (forcedPinNumber != null && pinNumber == forcedPinNumber) {
      forcedPinNumber = null;
    }
    setFocusedPin(findNextUnplacedPin(pinNumber));
  };

  const skipToNextConnectedPin = () => {
    const currentPinNumber = highlightedPin?.pinNumber ?? nextPinToPlace?.pinNumber;
    if (currentPinNumber == null) return;
    markSkippedPin(currentPinNumber);
    if (forcedPinNumber != null && currentPinNumber == forcedPinNumber) {
      forcedPinNumber = null;
    }
    setFocusedPin(findNextUnplacedPin(currentPinNumber, (pin) => isConnectedPin(pin.pinNumber)));
  };

  $effect(() => {
    if (!autoBodyEnabled) return;
    if (selectedPins.length === 0) {
      componentBodies = [];
      return;
    }
    const xs = selectedPins.map(pin => pin.x);
    const ys = selectedPins.map(pin => pin.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    componentBodies = [
      { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
    ];
  });

  $effect(() => {
    if (selectedPins.length === 0) return;
    const placed = new Set(selectedPins.map(pin => pin.pinNumber));
    const filtered = skippedPinNumbers.filter(pin => !placed.has(pin));
    if (filtered.length !== skippedPinNumbers.length) {
      skippedPinNumbers = filtered;
    }
    if (forcedPinNumber != null && placed.has(forcedPinNumber)) {
      forcedPinNumber = null;
    }
  });

  const onFinishCurrentFootprint = () => {
    const currentPartKey = footprintEditState.partKeyQueue[0];
    if (currentPartKey && parts[currentPartKey]) {
      const footprintToSave = { ...footprintEditState.currentFootprint };
      
      if (isEditingSharedFootprint) {
        partsWithSameFootprint.forEach(({ key }) => {
          if (parts[key]) {
            parts[key].footprint = { ...footprintToSave };
          }
        });
      } else {
        parts[currentPartKey].footprint = footprintToSave;
      }
    }
    footprintEditState.partKeyQueue.shift();
    resetEditingState();
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
</script>

{#if footprintEditState.partKeyQueue.length === 0}
  <PaneGroup direction="horizontal" class="flex-1 h-full">
    <!-- left side: PerfBoard, starts at 60 % width -->
    <Pane defaultSize={60} class="flex flex-col items-center justify-center">
      <PerfBoard numCols={20} numRows={20} {placedParts} />
    </Pane>

    <PaneResizer class="w-2 bg-accent-content hover:bg-accent cursor-col-resize transition-colors" />

    <Pane defaultSize={40} class="min-w-0 bg-base-200">
      <PartsList {parts} {footprintEditState} {onEditFootprint} {onFinishCurrentFootprint} {onCancelCurrentFootprint} {onEditMultipleFootprints} />
    </Pane>
  </PaneGroup>
{:else}
  <div class="fixed inset-0 z-50 flex items-start justify-center bg-base-200/70 backdrop-blur-sm p-0">
    <div class="w-full h-full max-w-none bg-base-100 border border-base-300 shadow-2xl rounded-none overflow-hidden">
      <FootprintEditorView 
        bind:perfboardCols={perfboardCols}
        bind:perfboardRows={perfboardRows}
        bind:variableFootprintSettings={variableFootprintSettings}
        bind:highlightedPin={highlightedPin}
        {selectedPins}
        {componentBodies}
        {footprintEditState}
        {parts}
        {parsedKiCadDoc}
        {availableFootprints}
        {currentPart}
        {currentPartPins}
        {nextPinToPlace}
        {allPinsPlaced}
        {isEditingSharedFootprint}
        {partsWithSameFootprint}
        getNetworkForPin={(partKey, pinNumber) => getNetworkForPin(parts, partKey, pinNumber, parsedKiCadDoc)}
        onCancel={onCancelCurrentFootprint}
        onFinish={onFinishCurrentFootprint}
        onColsChange={(cols) => {
          boardSizeManuallySet = true;
          perfboardCols = cols;
        }}
        onRowsChange={(rows) => {
          boardSizeManuallySet = true;
          perfboardRows = rows;
        }}
        onFootprintNameChange={(name) => {
          footprintEditState.currentFootprint.name = name;
        }}
        onLoadExistingFootprint={loadExistingFootprint}
        onSwitchFootprintType={switchFootprintType}
        onClearAllPins={clearAllPins}
        onUpdatePinName={updatePinName}
        onRemovePin={removePin}
        onSetHighlightedPin={(pin) => highlightedPin = pin}
        onSetPins={setSelectedPins}
        onSetBodies={setComponentBodies}
        onSelectPinToPlace={selectPinToPlace}
        onSkipNextPin={skipNextPin}
        onSkipNextConnectedPin={skipToNextConnectedPin}
        hideDisconnectedPins={hideDisconnectedPins}
        onToggleHideDisconnectedPins={() => hideDisconnectedPins = !hideDisconnectedPins}
        onClearAllBodies={clearAllBodies}
        onRemoveBody={removeBody}
        {handlePadClick}
        {handleBodyDrag}
        {handlePinDrag}
      />
    </div>
  </div>
{/if}
