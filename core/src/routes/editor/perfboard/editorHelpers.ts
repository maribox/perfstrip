import type { Footprint, NetworkInfo, PinPosition, VariableFootprintSettings, Part } from "$lib/types";
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

export const collectDragPinGroups = ({
  x,
  y,
  width,
  height,
  maxCols,
  maxRows,
  pinGroups
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  maxCols: number;
  maxRows: number;
  pinGroups: PartPin[][];
}): PinPosition[] => {
  const newPins: PinPosition[] = [];
  let groupIndex = 0;

  for (let rowI = y; rowI < y + height && groupIndex < pinGroups.length; rowI++) {
    for (let colI = x; colI < x + width && groupIndex < pinGroups.length; colI++) {
      if (colI < maxCols && rowI < maxRows) {
        const group = pinGroups[groupIndex];
        if (!group) return newPins;
        group.forEach((pin) => {
          newPins.push({
            x: colI,
            y: rowI,
            pinNumber: pin.pinNumber,
            name: pin.name
          });
        });
        groupIndex += 1;
      }
    }
  }

  return newPins;
};

export const groupPinsByNetwork = ({
  pins,
  currentPartKey,
  getNetworkForPin,
  priorityPinNumber
}: {
  pins: PartPin[];
  currentPartKey: string;
  getNetworkForPin: (partKey: string, pinNumber: string | number) => NetworkInfo | null;
  priorityPinNumber?: string | number | null;
}): PartPin[][] => {
  const groups = new Map<string, PartPin[]>();
  const order: string[] = [];
  let priorityKey: string | null = null;

  pins.forEach((pin) => {
    const network = getNetworkForPin(currentPartKey, pin.pinNumber);
    const hasNet = network && network.netName !== "No net";
    const key = hasNet ? `net:${network.netCode ?? network.netName}` : `pin:${pin.pinNumber}`;
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)?.push(pin);
    if (priorityPinNumber != null && pin.pinNumber == priorityPinNumber) {
      priorityKey = key;
    }
  });

  if (priorityKey && order[0] !== priorityKey) {
    return [priorityKey, ...order.filter((key) => key !== priorityKey)].map((key) => groups.get(key) ?? []);
  }
  return order.map((key) => groups.get(key) ?? []);
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
  defaultFootprints = [],
  variableFootprintSettings
}: {
  part: Part | null;
  defaultFootprints?: Footprint[];
  variableFootprintSettings: VariableFootprintSettings;
}): {
  currentFootprint: Footprint;
  selectedPins: PinPosition[];
  variableFootprintSettings: VariableFootprintSettings;
} => {
  if (part?.footprint) {
    const loaded = resolveFootprintLoad({
      footprintName: part.footprint.name,
      parts: { current: part } as Record<string, Part>,
      defaultFootprints,
      variableFootprintSettings
    }) ?? {
      currentFootprint: { ...part.footprint },
      selectedPins: part.footprint.layout.type === "fixed" ? [...part.footprint.layout.pins] : [],
      variableFootprintSettings
    };
    if (loaded.currentFootprint.name === "Default" && part.name) {
      loaded.currentFootprint.name = part.name;
    }
    return loaded;
  }

  return {
    currentFootprint: {
      name: part?.name || "Unknown",
      layout: { type: "fixed", pins: [] }
    },
    selectedPins: [],
    variableFootprintSettings
  };
};

export const defaultBoardSize = (pinCount: number) => {
  return Math.max(5, Math.ceil(pinCount / 2) + 1);
};
