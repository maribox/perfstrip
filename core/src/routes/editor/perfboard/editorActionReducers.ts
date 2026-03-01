import type { ComponentBody, FootprintEditState, PinInfo, PinPosition, VariableFootprintSettings } from "$lib/types";
import type { PartPin } from "xtoedif";
import { collectDragPinGroups, collectDragPins, resolveFootprintLoad } from "./editorHelpers";
import { DEFAULT_VARIABLE_FOOTPRINT_SETTINGS } from "./editorDefaults";

export const applyPadClick = ({
  x,
  y,
  currentPartKey,
  selectedPins,
  pinsToPlace,
  forcedPinNumber
}: {
  x: number;
  y: number;
  currentPartKey: string | null;
  selectedPins: PinPosition[];
  pinsToPlace: PartPin[];
  forcedPinNumber: string | number | null;
}) => {
  const existingPins = selectedPins.filter(pin => pin.x === x && pin.y === y);
  const existingPin = existingPins.length > 0 ? existingPins[existingPins.length - 1] : null;
  const unplacedPins = pinsToPlace.filter(
    (pin) => !selectedPins.some((selected) => selected.pinNumber == pin.pinNumber)
  );
  if (unplacedPins.length === 0) {
    if (!existingPin) return null;
    return {
      selectedPins,
      highlightedPin: { partKey: currentPartKey, pinNumber: existingPin.pinNumber } as PinInfo,
      forcedPinNumber
    };
  }
  const nextPins = [
    ...selectedPins,
    ...unplacedPins.map((pin) => ({ x, y, pinNumber: pin.pinNumber, name: pin.name }))
  ];
  const nextForced = forcedPinNumber != null && unplacedPins.some(pin => pin.pinNumber == forcedPinNumber)
    ? null
    : forcedPinNumber;
  return { selectedPins: nextPins, highlightedPin: null, forcedPinNumber: nextForced };
};

export const applyBodyDrag = ({
  x,
  y,
  width,
  height,
  componentBodies
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  componentBodies: ComponentBody[];
}) => {
  if (width <= 1 && height <= 1) return null;
  return {
    componentBodies: [...componentBodies, { x, y, width, height }],
    autoBodyEnabled: false
  };
};

export const applyPinDrag = ({
  x,
  y,
  width,
  height,
  maxCols,
  maxRows,
  selectedPins,
  availablePins,
  forcedPinNumber,
  pinGroups
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  maxCols: number;
  maxRows: number;
  selectedPins: PinPosition[];
  availablePins: PartPin[];
  forcedPinNumber: string | number | null;
  pinGroups?: PartPin[][];
}) => {
  const newPins = pinGroups
    ? collectDragPinGroups({ x, y, width, height, maxCols, maxRows, pinGroups })
    : collectDragPins({
        x,
        y,
        width,
        height,
        maxCols,
        maxRows,
        selectedPins,
        availablePins
      });
  if (newPins.length === 0) return null;
  const nextPins = [...selectedPins, ...newPins];
  const nextForced = forcedPinNumber != null && newPins.some(pin => pin.pinNumber == forcedPinNumber)
    ? null
    : forcedPinNumber;
  return { selectedPins: nextPins, forcedPinNumber: nextForced };
};

export const applyRemovePin = (selectedPins: PinPosition[], index: number) => {
  return selectedPins.filter((item, i) => i !== index);
};

export const applyClearPins = () => {
  return { selectedPins: [], forcedPinNumber: null, skippedPinNumbers: [] as Array<string | number> };
};

export const applyUpdatePinName = (selectedPins: PinPosition[], index: number, newName: string) => {
  return selectedPins.map((pin, i) =>
    i === index ? { ...pin, name: newName || "Pin" + pin.pinNumber } : pin
  );
};

export const applySwitchFootprintType = ({
  type,
  selectedPins,
  variableFootprintSettings
}: {
  type: "fixed" | "variable";
  selectedPins: PinPosition[];
  variableFootprintSettings: VariableFootprintSettings;
}) => {
  if (type === "fixed") {
    return {
      layout: { type: "fixed", pins: selectedPins } as FootprintEditState["currentFootprint"]["layout"]
    };
  }
  return {
    selectedPins: [] as PinPosition[],
    componentBodies: [] as ComponentBody[],
    forcedPinNumber: null as string | number | null,
    skippedPinNumbers: [] as Array<string | number>,
    layout: {
      type: "variable",
      minLength: variableFootprintSettings.minLength,
      maxLength: variableFootprintSettings.maxLength
    } as FootprintEditState["currentFootprint"]["layout"]
  };
};

export const applyLoadExistingFootprint = ({
  footprintName,
  parts,
  defaultFootprints,
  variableFootprintSettings
}: {
  footprintName: string;
  parts: Record<string, any>;
  defaultFootprints: any[];
  variableFootprintSettings: VariableFootprintSettings;
}) => {
  return resolveFootprintLoad({
    footprintName,
    parts,
    defaultFootprints,
    variableFootprintSettings
  });
};

export const applyResetEditingState = () => {
  return {
    selectedPins: [] as PinPosition[],
    componentBodies: [] as ComponentBody[],
    variableFootprintSettings: { ...DEFAULT_VARIABLE_FOOTPRINT_SETTINGS },
    highlightedPin: null as PinInfo | null,
    forcedPinNumber: null as string | number | null,
    skippedPinNumbers: [] as Array<string | number>,
    autoBodyEnabled: true
  };
};
