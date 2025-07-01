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
  let selectedPins: PinPosition[] = $state([]);
  let componentBodies: ComponentBody[] = $state([]);
  let variableFootprintSettings: VariableFootprintSettings = $state({ minLength: 3, maxLength: 10 });
  let highlightedPin = $state(null as any);

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
    componentBodies = componentBodies.filter((item, i) => i !== index);
  };

  let currentPart = $derived.by(() => {
    const currentPartKey = footprintEditState.partKeyQueue[0];
    return currentPartKey ? parts[currentPartKey] : null;
  });

  let currentPartPins = $derived.by(() => {
    const currentPartKey = footprintEditState.partKeyQueue[0];
    return getCurrentPartPins(parts, currentPartKey, selectedPins);
  });

  let nextPinToPlace = $derived.by(() => {
    if (!currentPartPins || currentPartPins.length === 0) return null;
    return currentPartPins.find(p => !p.isPlaced) || null;
  });

  let allPinsPlaced = $derived.by(() => {
    if (!currentPartPins || currentPartPins.length === 0) return false;
    return currentPartPins.every(pin => pin.isPlaced);
  });

  const handlePadClick = (x: number, y: number) => {
    if (footprintEditState.currentFootprint.layout.type === "fixed") {
      const existingIndex = selectedPins.findIndex(pin => pin.x === x && pin.y === y);
      if (existingIndex >= 0) {
        const existingPin = selectedPins[existingIndex];
        highlightedPin = { partKey: footprintEditState.partKeyQueue[0], pinNumber: existingPin.pinNumber };
      } else {
        const unplacedPin = currentPartPins.find(p => !p.isPlaced);
        if (unplacedPin) {
          selectedPins = [...selectedPins, { 
            x, 
            y, 
            pinNumber: unplacedPin.pinNumber,
            name: unplacedPin.name
          }];
          highlightedPin = null;
        }
      }
      if (footprintEditState.currentFootprint.layout.type === "fixed") {
        footprintEditState.currentFootprint.layout.pins = selectedPins;
      }
    }
  };

  const handleBodyDrag = (x: number, y: number, width: number, height: number) => {
    if (width > 1 || height > 1) {
      const newBody = { x, y, width, height };
      componentBodies = [...componentBodies, newBody];
    }
  };

  const handlePinDrag = (x: number, y: number, width: number, height: number) => {
    const newPins: typeof selectedPins = [];
    
    for (let rowI = y; rowI < y + height && newPins.length < currentPartPins.length - selectedPins.length; rowI++) {
      for (let colI = x; colI < x + width && newPins.length < currentPartPins.length - selectedPins.length; colI++) {
        if (colI < perfboardCols && rowI < perfboardRows) {
          const exists = selectedPins.some(pin => pin.x === colI && pin.y === rowI);
          if (!exists) {
            const unplacedPin = currentPartPins.find(p => !p.isPlaced && !newPins.some(np => np.pinNumber === p.pinNumber));
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
    if (footprintEditState.currentFootprint.layout.type === "fixed") {
      footprintEditState.currentFootprint.layout.pins = [];
    }
  };

  const clearAllBodies = () => {
    componentBodies = [];
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
  };

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

<PaneGroup direction="horizontal" class="flex-1 h-full">
  <!-- left side: PerfBoard, starts at 60 % width -->
  <Pane defaultSize={60} class="flex flex-col items-center justify-center">
    {#if footprintEditState.partKeyQueue.length === 0}
      <PerfBoard numCols={20} numRows={20} {placedParts} />
      {:else}
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
        onColsChange={(cols) => perfboardCols = cols}
        onRowsChange={(rows) => perfboardRows = rows}
        onFootprintNameChange={(name) => {
          footprintEditState.currentFootprint.name = name;
        }}
        onLoadExistingFootprint={loadExistingFootprint}
        onSwitchFootprintType={switchFootprintType}
        onClearAllPins={clearAllPins}
        onUpdatePinName={updatePinName}
        onRemovePin={removePin}
        onSetHighlightedPin={(pin) => highlightedPin = pin}
        onClearAllBodies={clearAllBodies}
        onRemoveBody={removeBody}
        {handlePadClick}
        {handleBodyDrag}
        {handlePinDrag}
      />
    {/if}
  </Pane>

  <PaneResizer class="w-2 bg-accent-content hover:bg-accent  cursor-col-resize transition-colors" />

  <Pane defaultSize={40} class="min-w-0 bg-base-200">
    <PartsList {parts} {footprintEditState} {onEditFootprint} {onFinishCurrentFootprint} {onCancelCurrentFootprint} {onEditMultipleFootprints} />
  </Pane>
</PaneGroup>
