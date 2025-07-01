<script lang="ts">
  import FootprintEditorHeader from "./FootprintEditorHeader.svelte";
  import PinNetworkInfo from "./PinNetworkInfo.svelte";
  import FootprintConfigPanel from "./FootprintConfigPanel.svelte";
  import PinsList from "./PinsList.svelte";
  import ComponentBodyList from "./ComponentBodyList.svelte";
  import VariableFootprintSettings from "./VariableFootprintSettings.svelte";
  import PerfBoard from "./PerfBoard.svelte";
  import type { Part, PinPosition } from "xtoedif";

  interface Props {
    perfboardCols: number;
    perfboardRows: number;
    selectedPins: PinPosition[];
    componentBodies: Array<{ x: number; y: number; width: number; height: number }>;
    variableFootprintSettings: { minLength: number; maxLength: number };
    footprintEditState: any;
    parts: Record<string, Part>;
    availableFootprints: string[];
    currentPart: Part | null;
    currentPartPins: any[];
    nextPinToPlace: any;
    highlightedPin: any;
    allPinsPlaced: boolean;
    isEditingSharedFootprint: boolean;
    partsWithSameFootprint: Array<{ key: string; part: Part }>;
    getNetworkForPin: (partKey: string, pinNumber: string | number) => any;
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
    onSetHighlightedPin: (pin: any) => void;
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

  {#if nextPinToPlace || highlightedPin}
    {@const displayPin = highlightedPin || nextPinToPlace}
    {@const networkInfo = displayPin ? getNetworkForPin(displayPin.partKey || footprintEditState.partKeyQueue[0], displayPin.pinNumber) : null}
    {@const isHighlighted = !!highlightedPin}
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
    onFootprintNameChange={onFootprintNameChange}
    onLoadExistingFootprint={onLoadExistingFootprint}
    onSwitchFootprintType={onSwitchFootprintType}
  />

  <div class="flex gap-4">
    {#if footprintEditState.currentFootprint.layout.type === "fixed"}
      <PinsList 
        {currentPartPins}
        {selectedPins}
        {allPinsPlaced}
        footprintEditQueuePartKey={footprintEditState.partKeyQueue[0]}
        onClearAllPins={onClearAllPins}
        onUpdatePinName={onUpdatePinName}
        onRemovePin={onRemovePin}
        onSetHighlightedPin={onSetHighlightedPin}
      />

      <ComponentBodyList 
        {componentBodies}
        onClearAllBodies={onClearAllBodies}
        onRemoveBody={onRemoveBody}
      />
    {:else}
      <VariableFootprintSettings 
        bind:minLength={variableFootprintSettings.minLength}
        bind:maxLength={variableFootprintSettings.maxLength}
        onMinLengthChange={(value) => variableFootprintSettings.minLength = value}
        onMaxLengthChange={(value) => variableFootprintSettings.maxLength = value}
      />
    {/if}
  </div>
</div>
