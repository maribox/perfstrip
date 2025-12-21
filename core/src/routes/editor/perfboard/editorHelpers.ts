import type { Footprint, PinPosition, VariableFootprintSettings, Part } from "$lib/types";
import type { PartPin } from "xtoedif";

export const collectDragPins = ({
  x,
  y,
  width,
  height,
  maxCols,
  maxRows,
  selectedPins,
  availablePins
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  maxCols: number;
  maxRows: number;
  selectedPins: PinPosition[];
  availablePins: PartPin[];
}): PinPosition[] => {
  const newPins: PinPosition[] = [];
  let pinIndex = 0;
  const remainingPins = availablePins.length;

  for (let rowI = y; rowI < y + height && newPins.length < remainingPins; rowI++) {
    for (let colI = x; colI < x + width && newPins.length < remainingPins; colI++) {
      if (colI < maxCols && rowI < maxRows) {
        const exists = selectedPins.some(pin => pin.x === colI && pin.y === rowI);
        if (exists) continue;
        const nextPin = availablePins[pinIndex];
        if (!nextPin) return newPins;
        newPins.push({
          x: colI,
          y: rowI,
          pinNumber: nextPin.pinNumber,
          name: nextPin.name
        });
        pinIndex += 1;
      }
    }
  }

  return newPins;
};

export const resolveFootprintLoad = ({
  footprintName,
  parts,
  defaultFootprints,
  variableFootprintSettings
}: {
  footprintName: string;
  parts: Record<string, Part>;
  defaultFootprints: Footprint[];
  variableFootprintSettings: VariableFootprintSettings;
}): {
  currentFootprint: Footprint;
  selectedPins: PinPosition[];
  variableFootprintSettings: VariableFootprintSettings;
} | null => {
  const partWithFootprint = Object.values(parts).find(part => part.footprint?.name === footprintName);
  const footprint = partWithFootprint?.footprint ?? defaultFootprints.find(fp => fp?.name === footprintName);
  if (!footprint) return null;

  if (footprint.layout.type === "fixed") {
    return {
      currentFootprint: { ...footprint },
      selectedPins: [...footprint.layout.pins],
      variableFootprintSettings
    };
  }

  return {
    currentFootprint: { ...footprint },
    selectedPins: [],
    variableFootprintSettings: {
      minLength: footprint.layout.minLength || 3,
      maxLength: footprint.layout.maxLength || 10
    }
  };
};

export const initFootprintEditForPart = ({
  part,
  defaultFootprints,
  variableFootprintSettings
}: {
  part: Part | null;
  defaultFootprints: Footprint[];
  variableFootprintSettings: VariableFootprintSettings;
}): {
  currentFootprint: Footprint;
  selectedPins: PinPosition[];
  variableFootprintSettings: VariableFootprintSettings;
} => {
  if (part?.footprint) {
    return resolveFootprintLoad({
      footprintName: part.footprint.name,
      parts: { current: part } as Record<string, Part>,
      defaultFootprints: [],
      variableFootprintSettings
    }) ?? {
      currentFootprint: { ...part.footprint },
      selectedPins: part.footprint.layout.type === "fixed" ? [...part.footprint.layout.pins] : [],
      variableFootprintSettings
    };
  }

  return {
    currentFootprint: {
      name: (part?.name || "Unknown") + " Footprint",
      layout: { type: "fixed", pins: [] }
    },
    selectedPins: [],
    variableFootprintSettings
  };
};

export const defaultBoardSize = (pinCount: number) => {
  return Math.ceil(pinCount / 2) + 1;
};
