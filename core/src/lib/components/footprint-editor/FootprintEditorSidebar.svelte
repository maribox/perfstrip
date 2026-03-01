<script lang="ts">
  import FootprintConfigPanel from "./FootprintConfigPanel.svelte";
  import PinsList from "./PinsList.svelte";
  import ComponentBodyList from "./ComponentBodyList.svelte";
  import IconIconParkOutlineResistor from "~icons/icon-park-outline/resistor";
  import IconIconoirElectronicsTransistor from "~icons/iconoir/electronics-transistor";
  import IconFluentDeveloperBoard16Regular from "~icons/fluent/developer-board-16-regular";
  import IconIconParkOutlineFileQuestion from "~icons/icon-park-outline/file-question";
  import type { Part, PinPosition } from "xtoedif";
  import type { 
    ComponentBody, 
    VariableFootprintSettings as VariableFootprintSettingsType,
    FootprintEditState,
    PartPin,
    NetworkInfo,
    PinInfo
  } from "$lib/types";
  type PinRow = PartPin & { isPlaced: boolean; isSkipped?: boolean; pinFunction?: string };

  interface Props {
    currentPart: Part | null;
    footprintEditState: FootprintEditState;
    availableFootprints: string[];
    parts: Record<string, Part>;
    isEditingSharedFootprint: boolean;
    partsWithSameFootprint: Array<{ key: string; part: Part }>;
    variableFootprintSettings: VariableFootprintSettingsType;
    onFootprintNameChange: (name: string) => void;
    onLoadExistingFootprint: (name: string) => void;
    onSwitchFootprintType: (type: "fixed" | "variable") => void;
    onCancel: () => void;
    onFinish: () => void;
    allPinsPlaced: boolean;
    currentPartPins: PinRow[];
    selectedPins: PinPosition[];
    nextPinToPlace: PinInfo | null;
    getNetworkForPin: (partKey: string, pinNumber: string | number) => NetworkInfo | null;
    highlightedPin: PinInfo | null;
    onClearAllPins: () => void;
    onUpdatePinName: (index: number, newName: string) => void;
    onRemovePin: (index: number) => void;
    onSetHighlightedPin: (pin: PinInfo | null) => void;
    onSelectPinToPlace: (pinNumber: string | number) => void;
    onSkipNextPin: () => void;
    onSkipNextConnectedPin: () => void;
    hideDisconnectedPins: boolean;
    onToggleHideDisconnectedPins: () => void;
    groupConnectedPins: boolean;
    onToggleGroupConnectedPins: () => void;
    componentBodies: ComponentBody[];
    onClearAllBodies: () => void;
    onRemoveBody: (index: number) => void;
    onPartNameChange?: (name: string) => void;
  }

  const { 
    currentPart,
    footprintEditState,
    availableFootprints,
    parts,
    isEditingSharedFootprint,
    partsWithSameFootprint,
    variableFootprintSettings,
    onFootprintNameChange,
    onLoadExistingFootprint,
    onSwitchFootprintType,
    onCancel,
    onFinish,
    allPinsPlaced,
    currentPartPins,
    selectedPins,
    nextPinToPlace,
    getNetworkForPin,
    highlightedPin,
    onClearAllPins,
    onUpdatePinName,
    onRemovePin,
    onSetHighlightedPin,
    onSelectPinToPlace,
    onSkipNextPin,
    onSkipNextConnectedPin,
    hideDisconnectedPins,
    onToggleHideDisconnectedPins,
    groupConnectedPins,
    onToggleGroupConnectedPins,
    componentBodies,
    onClearAllBodies,
    onRemoveBody,
    onPartNameChange
  }: Props = $props();

  const isScratchPart = $derived(currentPart != null && (!currentPart.pins || currentPart.pins.length === 0));
</script>

<div class="w-full max-w-[33%] flex flex-col gap-5 pr-2 min-h-0 overflow-hidden">
  <div class="rounded-xl bg-base-200/60 p-4 flex flex-col gap-3">
    <div class="flex items-start justify-between gap-3">
      {#if currentPart}
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-9 h-9 rounded-full bg-base-300 text-base-content flex items-center justify-center">
            {#if currentPart.type === "Resistor"}
              <IconIconParkOutlineResistor class="w-5 h-5" />
            {:else if currentPart.type === "Transistor"}
              <IconIconoirElectronicsTransistor class="w-5 h-5" />
            {:else if currentPart.type === "Board"}
              <IconFluentDeveloperBoard16Regular class="w-5 h-5" />
            {:else if currentPart.type}
              <span class="text-xs font-semibold">{currentPart.type[0]}</span>
            {:else}
              <IconIconParkOutlineFileQuestion class="w-5 h-5" />
            {/if}
          </div>
          <div class="min-w-0">
            <div class="text-xs uppercase tracking-wide text-base-content/50">{isScratchPart ? "New Part" : "Editing"}</div>
            {#if isScratchPart && onPartNameChange}
              <input
                type="text"
                class="input input-sm input-ghost font-semibold text-sm p-0 h-6 w-full"
                placeholder="Part name"
                value={currentPart.name}
                oninput={(e) => onPartNameChange(e.currentTarget.value)}
              />
            {:else}
              <div class="text-sm font-semibold truncate">{currentPart.name}</div>
            {/if}
            {#if currentPart.description && !isScratchPart}
              <div class="text-xs text-base-content/60 line-clamp-1">{currentPart.description}</div>
            {/if}
          </div>
        </div>
      {:else}
        <div class="text-xs uppercase tracking-wide text-base-content/50">Editing</div>
      {/if}
      <div class="flex gap-2">
        <button class="btn btn-ghost btn-sm px-3" onclick={onCancel}>
          Cancel
        </button>
        <button 
          class="btn btn-primary btn-sm px-3" 
          onclick={onFinish}
          disabled={footprintEditState.currentFootprint.layout.type === "fixed" && !allPinsPlaced}
        >
          OK
        </button>
      </div>
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
  </div>

  {#if footprintEditState.currentFootprint.layout.type === "fixed"}
    <div class="rounded-xl bg-base-200/60 p-4 flex flex-col gap-4 flex-1 min-h-0">
      <div class="flex flex-col gap-4 flex-1 min-h-0">
        <div class="flex-1 min-h-0">
          <PinsList 
            {currentPartPins}
            {selectedPins}
            {allPinsPlaced}
            {nextPinToPlace}
            {getNetworkForPin}
            footprintEditQueuePartKey={footprintEditState.partKeyQueue[0]}
            highlightedPinNumber={highlightedPin?.pinNumber}
            onClearAllPins={onClearAllPins}
            onUpdatePinName={onUpdatePinName}
            onRemovePin={onRemovePin}
            onSetHighlightedPin={onSetHighlightedPin}
            onSelectPinToPlace={onSelectPinToPlace}
            onSkipNextPin={onSkipNextPin}
            onSkipNextConnectedPin={onSkipNextConnectedPin}
            hideDisconnectedPins={hideDisconnectedPins}
            onToggleHideDisconnected={onToggleHideDisconnectedPins}
            groupConnectedPins={groupConnectedPins}
            onToggleGroupConnected={onToggleGroupConnectedPins}
          />
        </div>

        <div class="min-h-0">
          <ComponentBodyList 
            {componentBodies}
            {onClearAllBodies}
            {onRemoveBody}
          />
        </div>
      </div>
    </div>
  {/if}
</div>
