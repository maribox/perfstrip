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
  getCurrentPartKey,
  getPinsToPlace,
  getSelectedPins,
  setPins,
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
  getCurrentPartKey: () => string | null;
  getPinsToPlace: () => PartPin[];
  getSelectedPins: () => PinPosition[];
  setPins: (pins: PinPosition[]) => void;
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
    const pinsToPlace = getPinsToPlace();
    // Scratch part: no predefined pins, so create a new pin on each click
    if (pinsToPlace.length === 0 && getSelectedPins().every(p => p.x !== x || p.y !== y)) {
      const selectedPins = getSelectedPins();
      const nextPinNumber = selectedPins.length > 0
        ? Math.max(...selectedPins.map(p => typeof p.pinNumber === "number" ? p.pinNumber : parseInt(String(p.pinNumber)) || 0)) + 1
        : 1;
      setPins([...selectedPins, { x, y, pinNumber: nextPinNumber, name: `${nextPinNumber}` }]);
      return;
    }
    const result = applyPadClick({
      x,
      y,
      currentPartKey: getCurrentPartKey(),
      selectedPins: getSelectedPins(),
      pinsToPlace,
      forcedPinNumber: getForcedPinNumber()
    });
    if (!result) return;
    setPins(result.selectedPins);
    setHighlightedPin(result.highlightedPin);
    setForcedPinNumber(result.forcedPinNumber);
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
    setPins(result.selectedPins);
    setForcedPinNumber(result.forcedPinNumber);
  };

  const removePin = (index: number) => {
    const nextPins = applyRemovePin(getSelectedPins(), index);
    setPins(nextPins);
  };

  const clearAllPins = () => {
    const cleared = applyClearPins();
    setPins(cleared.selectedPins);
    setForcedPinNumber(cleared.forcedPinNumber);
    setSkippedPinNumbers(cleared.skippedPinNumbers);
  };

  const updatePinName = (index: number, newName: string) => {
    const nextPins = applyUpdatePinName(getSelectedPins(), index, newName);
    setPins(nextPins);
  };

  const switchFootprintType = (type: "fixed" | "variable") => {
    const next = applySwitchFootprintType({
      type,
      selectedPins: getSelectedPins(),
      variableFootprintSettings: getVariableFootprintSettings()
    });
    setLayout(next.layout);
    if ("selectedPins" in next && next.selectedPins !== undefined) setPins(next.selectedPins);
    if ("componentBodies" in next && next.componentBodies !== undefined) setComponentBodies(next.componentBodies);
    if ("forcedPinNumber" in next && next.forcedPinNumber !== undefined) setForcedPinNumber(next.forcedPinNumber);
    if ("skippedPinNumbers" in next && next.skippedPinNumbers !== undefined) setSkippedPinNumbers(next.skippedPinNumbers);
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
    setPins(result.selectedPins);
    setVariableFootprintSettings(result.variableFootprintSettings);
    return result.currentFootprint;
  };

  const resetEditingState = () => {
    const reset = applyResetEditingState();
    setPins(reset.selectedPins);
    setComponentBodies(reset.componentBodies);
    setVariableFootprintSettings(reset.variableFootprintSettings);
    setHighlightedPin(reset.highlightedPin);
    setForcedPinNumber(reset.forcedPinNumber);
    setSkippedPinNumbers(reset.skippedPinNumbers);
    setAutoBodyEnabled(reset.autoBodyEnabled);
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
