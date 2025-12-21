import { DEFAULT_FOOTPRINTS } from "xtoedif";
import { getCurrentPartPins } from "$lib/utils";
import type { Part, PinPosition, FootprintEditState } from "$lib/types";

export const computeDerivedState = ({
  parts,
  footprintEditState,
  selectedPins,
  skippedPinNumbers,
  forcedPinNumber,
  hideDisconnectedPins,
  parsedKiCadDoc,
  getNetworkForPin
}: {
  parts: Record<string, Part>;
  footprintEditState: FootprintEditState;
  selectedPins: PinPosition[];
  skippedPinNumbers: Array<string | number>;
  forcedPinNumber: string | number | null;
  hideDisconnectedPins: boolean;
  parsedKiCadDoc: any;
  getNetworkForPin: typeof import("$lib/utils").getNetworkForPin;
}) => {
  const currentPartKey = footprintEditState.partKeyQueue[0] ?? null;
  const currentPart = currentPartKey ? parts[currentPartKey] : null;

  const availableFootprints = (() => {
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
  })();

  const currentFootprintName = footprintEditState.currentFootprint.name;
  const partsWithSameFootprint = currentFootprintName
    ? Object.entries(parts)
        .filter(([key, part]) => {
          if (part.footprint?.name === currentFootprintName) return true;
          return key === currentPartKey && currentFootprintName.trim() !== "";
        })
        .map(([key, part]) => ({ key, part }))
    : [];
  const isEditingSharedFootprint = partsWithSameFootprint.length > 1;

  const getPinNetwork = (pinNumber: string | number) => {
    if (!currentPartKey) return null;
    return getNetworkForPin(parts, currentPartKey, pinNumber, parsedKiCadDoc);
  };

  const isConnectedPin = (pinNumber: string | number) => {
    const network = getPinNetwork(pinNumber);
    return !!network && network.netName !== "No net";
  };

  const basePartPins = currentPartKey ? getCurrentPartPins(parts, currentPartKey, selectedPins) : [];
  const currentPartPins = basePartPins.map((pin) => {
    const isSkipped = skippedPinNumbers.some((p) => p == pin.pinNumber);
    return {
      ...pin,
      isSkipped,
      isPlaced: pin.isPlaced || isSkipped
    };
  });

  const unplacedPins = currentPartPins.filter((pin) => !pin.isPlaced);
  const filteredUnplacedPins = hideDisconnectedPins
    ? unplacedPins.filter((pin) => isConnectedPin(pin.pinNumber))
    : unplacedPins;

  const nextPinToPlace = (() => {
    if (filteredUnplacedPins.length === 0) return null;
    if (forcedPinNumber != null) {
      const forcedPin = filteredUnplacedPins.find(p => p.pinNumber == forcedPinNumber);
      if (forcedPin) return forcedPin;
    }
    return filteredUnplacedPins[0];
  })();

  const allPinsPlaced = (() => {
    if (currentPartPins.length === 0) return false;
    const relevantPins = currentPartPins.filter((pin) => isConnectedPin(pin.pinNumber));
    if (relevantPins.length === 0) return true;
    return relevantPins.every(pin => pin.isPlaced);
  })();

  return {
    availableFootprints,
    partsWithSameFootprint,
    isEditingSharedFootprint,
    currentPartKey,
    currentPart,
    currentPartPins,
    filteredUnplacedPins,
    nextPinToPlace,
    allPinsPlaced,
    isConnectedPin
  };
};
