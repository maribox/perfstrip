<script lang="ts">
  import FootprintEditorBoard from "./FootprintEditorBoard.svelte";
  import FootprintEditorSidebar from "./FootprintEditorSidebar.svelte";
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
    onSetPins: (pins: PinPosition[]) => void;
    onSetBodies: (bodies: ComponentBody[]) => void;
    onSelectPinToPlace: (pinNumber: string | number) => void;
    onSkipNextPin: () => void;
    onSkipNextConnectedPin: () => void;
    hideDisconnectedPins: boolean;
    onToggleHideDisconnectedPins: () => void;
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
    onSetPins,
    onSetBodies,
    onSelectPinToPlace,
    onSkipNextPin,
    onSkipNextConnectedPin,
    hideDisconnectedPins,
    onToggleHideDisconnectedPins,
    onClearAllBodies,
    onRemoveBody,
    handlePadClick,
    handleBodyDrag,
    handlePinDrag
  }: Props = $props();

</script>

<div class="w-full h-full flex flex-col gap-6 p-6">
  <div class="flex flex-1 gap-8 overflow-hidden">
    <FootprintEditorBoard
      bind:perfboardCols
      bind:perfboardRows
      {selectedPins}
      {componentBodies}
      {onSetPins}
      {onSetBodies}
      {onColsChange}
      {onRowsChange}
      {handlePadClick}
      {handleBodyDrag}
      {handlePinDrag}
    />

    <FootprintEditorSidebar
      {currentPart}
      {footprintEditState}
      {availableFootprints}
      {parts}
      {isEditingSharedFootprint}
      {partsWithSameFootprint}
      {variableFootprintSettings}
      {onFootprintNameChange}
      {onLoadExistingFootprint}
      {onSwitchFootprintType}
      {onCancel}
      {onFinish}
      {allPinsPlaced}
      {currentPartPins}
      {selectedPins}
      {nextPinToPlace}
      {getNetworkForPin}
      {highlightedPin}
      {onClearAllPins}
      {onUpdatePinName}
      {onRemovePin}
      {onSetHighlightedPin}
      {onSelectPinToPlace}
      {onSkipNextPin}
      {onSkipNextConnectedPin}
      {hideDisconnectedPins}
      {onToggleHideDisconnectedPins}
      {componentBodies}
      {onClearAllBodies}
      {onRemoveBody}
    />
  </div>
</div>
