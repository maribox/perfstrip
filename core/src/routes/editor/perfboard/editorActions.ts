import type { ComponentBody, FootprintEditState, NetworkInfo, PinInfo, PinPosition, VariableFootprintSettings } from "$lib/types";
import type { PartPin } from "xtoedif";
import { groupPinsByNetwork } from "./editorHelpers";
import {
  applyBodyDrag,
  applyClearPins,
  applyLoadExistingFootprint,
  applyPadClick,
  applyPinDrag,
  applyRemovePin,
  applyResetEditingState,
  applySwitchFootprintType,
  applyUpdatePinName
} from "./editorActionReducers";

export const createEditorActions = ({
  getLayoutType,
  setLayoutPins,
  getCurrentPartKey,
  getPinsToPlace,
  getSelectedPins,
  setSelectedPins,
  setHighlightedPin,
  getForcedPinNumber,
  setForcedPinNumber,
  setSkippedPinNumbers,
  getComponentBodies,
  setComponentBodies,
  setAutoBodyEnabled,
  getPerfboardCols,
  getPerfboardRows,
  getFilteredUnplacedPins,
  getGroupConnectedPins,
  getNetworkForPin,
  getVariableFootprintSettings,
  setVariableFootprintSettings,
  setLayout
}: {
  getLayoutType: () => "fixed" | "variable";
  setLayoutPins: (pins: PinPosition[]) => void;
  getCurrentPartKey: () => string | null;
  getPinsToPlace: () => PartPin[];
  getSelectedPins: () => PinPosition[];
  setSelectedPins: (pins: PinPosition[]) => void;
  setHighlightedPin: (pin: PinInfo | null) => void;
  getForcedPinNumber: () => string | number | null;
  setForcedPinNumber: (value: string | number | null) => void;
  setSkippedPinNumbers: (value: Array<string | number>) => void;
  getComponentBodies: () => ComponentBody[];
  setComponentBodies: (value: ComponentBody[]) => void;
  setAutoBodyEnabled: (value: boolean) => void;
  getPerfboardCols: () => number;
  getPerfboardRows: () => number;
  getFilteredUnplacedPins: () => PartPin[];
  getGroupConnectedPins: () => boolean;
  getNetworkForPin: (partKey: string, pinNumber: string | number) => NetworkInfo | null;
  getVariableFootprintSettings: () => VariableFootprintSettings;
  setVariableFootprintSettings: (value: VariableFootprintSettings) => void;
  setLayout: (layout: FootprintEditState["currentFootprint"]["layout"]) => void;
}) => {
  const handlePadClick = (x: number, y: number) => {
    if (getLayoutType() !== "fixed") return;
    const result = applyPadClick({
      x,
      y,
      currentPartKey: getCurrentPartKey(),
      selectedPins: getSelectedPins(),
      pinsToPlace: getPinsToPlace(),
      forcedPinNumber: getForcedPinNumber()
    });
    if (!result) return;
    setSelectedPins(result.selectedPins);
    setHighlightedPin(result.highlightedPin);
    setForcedPinNumber(result.forcedPinNumber);
    setLayoutPins(result.selectedPins);
  };

  const handleBodyDrag = (x: number, y: number, width: number, height: number) => {
    const result = applyBodyDrag({ x, y, width, height, componentBodies: getComponentBodies() });
    if (!result) return;
    setComponentBodies(result.componentBodies);
    setAutoBodyEnabled(result.autoBodyEnabled);
  };

  const handlePinDrag = (x: number, y: number, width: number, height: number) => {
    const availablePins = getFilteredUnplacedPins();
    const currentPartKey = getCurrentPartKey();
    const forcedPinNumber = getForcedPinNumber();
    const pinGroups = getGroupConnectedPins() && currentPartKey
      ? groupPinsByNetwork({ pins: availablePins, currentPartKey, getNetworkForPin, priorityPinNumber: forcedPinNumber })
      : undefined;
    const result = applyPinDrag({
      x,
      y,
      width,
      height,
      maxCols: getPerfboardCols(),
      maxRows: getPerfboardRows(),
      selectedPins: getSelectedPins(),
      availablePins,
      forcedPinNumber,
      pinGroups
    });
    if (!result) return;
    setSelectedPins(result.selectedPins);
    setForcedPinNumber(result.forcedPinNumber);
    if (getLayoutType() === "fixed") {
      setLayoutPins(result.selectedPins);
    }
  };

  const removePin = (index: number) => {
    const nextPins = applyRemovePin(getSelectedPins(), index);
    setSelectedPins(nextPins);
    if (getLayoutType() === "fixed") {
      setLayoutPins(nextPins);
    }
  };

  const clearAllPins = () => {
    const cleared = applyClearPins();
    setSelectedPins(cleared.selectedPins);
    setForcedPinNumber(cleared.forcedPinNumber);
    setSkippedPinNumbers(cleared.skippedPinNumbers);
    if (getLayoutType() === "fixed") {
      setLayoutPins([]);
    }
  };

  const updatePinName = (index: number, newName: string) => {
    const nextPins = applyUpdatePinName(getSelectedPins(), index, newName);
    setSelectedPins(nextPins);
    if (getLayoutType() === "fixed") {
      setLayoutPins(nextPins);
    }
  };

  const switchFootprintType = (type: "fixed" | "variable") => {
    const next = applySwitchFootprintType({
      type,
      selectedPins: getSelectedPins(),
      variableFootprintSettings: getVariableFootprintSettings()
    });
    if ("selectedPins" in next && next.selectedPins !== undefined) setSelectedPins(next.selectedPins);
    if ("componentBodies" in next && next.componentBodies !== undefined) setComponentBodies(next.componentBodies);
    if ("forcedPinNumber" in next && next.forcedPinNumber !== undefined) setForcedPinNumber(next.forcedPinNumber);
    if ("skippedPinNumbers" in next && next.skippedPinNumbers !== undefined) setSkippedPinNumbers(next.skippedPinNumbers);
    setLayout(next.layout);
  };

  const loadExistingFootprint = (
    footprintName: string,
    parts: Record<string, any>,
    defaultFootprints: any[]
  ) => {
    const result = applyLoadExistingFootprint({
      footprintName,
      parts,
      defaultFootprints,
      variableFootprintSettings: getVariableFootprintSettings()
    });
    if (!result) return null;
    setSelectedPins(result.selectedPins);
    setVariableFootprintSettings(result.variableFootprintSettings);
    return result.currentFootprint;
  };

  const resetEditingState = () => {
    const reset = applyResetEditingState();
    setSelectedPins(reset.selectedPins);
    setComponentBodies(reset.componentBodies);
    setVariableFootprintSettings(reset.variableFootprintSettings);
    setHighlightedPin(reset.highlightedPin);
    setForcedPinNumber(reset.forcedPinNumber);
    setSkippedPinNumbers(reset.skippedPinNumbers);
    setAutoBodyEnabled(reset.autoBodyEnabled);
    return reset.boardSizeManuallySet;
  };

  return {
    handlePadClick,
    handleBodyDrag,
    handlePinDrag,
    removePin,
    clearAllPins,
    updatePinName,
    switchFootprintType,
    loadExistingFootprint,
    resetEditingState
  };
};
