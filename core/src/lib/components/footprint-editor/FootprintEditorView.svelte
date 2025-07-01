<script lang="ts">
  import FootprintEditorHeader from "./FootprintEditorHeader.svelte";
  import PinNetworkInfo from "./PinNetworkInfo.svelte";
  import FootprintConfigPanel from "./FootprintConfigPanel.svelte";
  import PinsList from "./PinsList.svelte";
  import ComponentBodyList from "./ComponentBodyList.svelte";
  import PerfBoard from "../PerfBoard.svelte";
  import type { Part, PinPosition } from "xtoedif";
  import type { 
    ComponentBody, 
    VariableFootprintSettings as VariableFootprintSettingsType,
    FootprintEditState,
    PartPin,
    NetworkInfo,
    PinInfo
  } from "$lib/types";

  interface Props {
    perfboardCols: number;
    perfboardRows: number;
    selectedPins: PinPosition[];
    componentBodies: ComponentBody[];
    variableFootprintSettings: VariableFootprintSettingsType;
    footprintEditState: FootprintEditState;
    parts: Record<string, Part>;
    parsedKiCadDoc: any;
    availableFootprints: string[];
    currentPart: Part | null;
    currentPartPins: PartPin[];
    nextPinToPlace: PinInfo | null;
    highlightedPin: PinInfo | null;
    allPinsPlaced: boolean;
    isEditingSharedFootprint: boolean;
    partsWithSameFootprint: Array<{ key: string; part: Part }>;
    getNetworkForPin: (partKey: string, pinNumber: string | number) => NetworkInfo | null;
    onCancel: () => void;
    onFinish: () => void;
    onColsChange: (cols: number) => void;
    onRowsChange: (rows: number) => void;
    onFootprintNameChange: (name: string) => void;
    onLoadExistingFootprint: (name: string) => void;
    onSwitchFootprintType: (type: "fixed" | "variable") => void;
    onClearAllPins: () => void;
    onUpdatePinName: (index: number, newName: string) => void;
    onRemovePin: (index: number) => void;
    onSetHighlightedPin: (pin: PinInfo | null) => void;
    onClearAllBodies: () => void;
    onRemoveBody: (index: number) => void;
    handlePadClick: (x: number, y: number) => void;
    handleBodyDrag: (x: number, y: number, width: number, height: number) => void;
    handlePinDrag: (x: number, y: number, width: number, height: number) => void;
  }

  let { 
    perfboardCols = $bindable(),
    perfboardRows = $bindable(),
    selectedPins,
    componentBodies,
    variableFootprintSettings = $bindable(),
    footprintEditState,
    parts,
    parsedKiCadDoc,
    availableFootprints,
    currentPart,
    currentPartPins,
    nextPinToPlace,
    highlightedPin = $bindable(),
    allPinsPlaced,
    isEditingSharedFootprint,
    partsWithSameFootprint,
    getNetworkForPin,
    onCancel,
    onFinish,
    onColsChange,
    onRowsChange,
    onFootprintNameChange,
    onLoadExistingFootprint,
    onSwitchFootprintType,
    onClearAllPins,
    onUpdatePinName,
    onRemovePin,
    onSetHighlightedPin,
    onClearAllBodies,
    onRemoveBody,
    handlePadClick,
    handleBodyDrag,
    handlePinDrag
  }: Props = $props();
</script>

<div class="w-full h-full flex flex-col gap-3 p-3 overflow-y-auto">
  <FootprintEditorHeader 
    bind:perfboardCols={perfboardCols}
    bind:perfboardRows={perfboardRows}
    {allPinsPlaced}
    currentFootprintType={footprintEditState.currentFootprint.layout.type}
    onCancel={onCancel}
    onFinish={onFinish}
    onColsChange={onColsChange}
    onRowsChange={onRowsChange}
  />

  {#if nextPinToPlace}
    {@const displayPin = nextPinToPlace}
    {@const networkInfo = displayPin ? getNetworkForPin(displayPin.partKey || footprintEditState.partKeyQueue[0], displayPin.pinNumber) : null}
    {@const isHighlighted = !!highlightedPin && highlightedPin.pinNumber === displayPin.pinNumber}
    {@const pinnedPlaced = selectedPins.find(sp => sp.pinNumber == displayPin?.pinNumber)}
    
    <PinNetworkInfo 
      {displayPin}
      {networkInfo}
      {isHighlighted}
      {pinnedPlaced}
      {selectedPins}
      onRemovePin={() => {
        const index = selectedPins.findIndex(sp => sp.pinNumber == highlightedPin?.pinNumber);
        if (index >= 0) {
          onRemovePin(index);
          highlightedPin = null;
        }
      }}
      onClearHighlight={() => highlightedPin = null}
    />
  {/if}

  <div class="flex items-center justify-center shrink-0" style="height: 350px;">
    <PerfBoard 
      numCols={perfboardCols} 
      numRows={perfboardRows} 
      placedParts={[]} 
      onPadClick={handlePadClick}
      selectedPins={selectedPins}
      componentBody={componentBodies}
      onBodyDrag={handleBodyDrag}
      onPinDrag={handlePinDrag}
      pinLimitReached={allPinsPlaced}
      maxWidth={320}
      maxHeight={320}
    />
  </div>

  <FootprintConfigPanel 
    currentFootprint={footprintEditState.currentFootprint}
    {availableFootprints}
    {parts}
    {isEditingSharedFootprint}
    {partsWithSameFootprint}
    {currentPart}
    {variableFootprintSettings}
    onFootprintNameChange={onFootprintNameChange}
    onLoadExistingFootprint={onLoadExistingFootprint}
    onSwitchFootprintType={onSwitchFootprintType}
    onMinLengthChange={(value) => variableFootprintSettings.minLength = value}
    onMaxLengthChange={(value) => variableFootprintSettings.maxLength = value}
  />

  <div class="flex gap-4">
    {#if footprintEditState.currentFootprint.layout.type === "fixed"}
      <div class="flex-1">
        <PinsList 
          {currentPartPins}
          {selectedPins}
          {allPinsPlaced}
          {nextPinToPlace}
          {parts}
          {parsedKiCadDoc}
          {getNetworkForPin}
          footprintEditQueuePartKey={footprintEditState.partKeyQueue[0]}
          onClearAllPins={onClearAllPins}
          onUpdatePinName={onUpdatePinName}
          onRemovePin={onRemovePin}
          onSetHighlightedPin={onSetHighlightedPin}
        />
        
        <ComponentBodyList 
          {componentBodies}
          {onClearAllBodies}
          {onRemoveBody}
        />
      </div>
    {/if}
  </div>
</div>
