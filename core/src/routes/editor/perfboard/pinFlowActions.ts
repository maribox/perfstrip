import type { PinInfo } from "$lib/types";
import type { PartPin } from "xtoedif";
import { selectPin, skipPin } from "./pinFlowHelpers";

type PinEntry = { pinNumber: string | number; isPlaced: boolean };

type PinFlowDeps = {
  getCurrentPartKey: () => string | null;
  getCurrentPartPins: () => PinEntry[];
  getNextPinToPlace: () => PartPin | null;
  getHighlightedPin: () => PinInfo | null;
  getForcedPinNumber: () => string | number | null;
  getSkippedPinNumbers: () => Array<string | number>;
  getHideDisconnectedPins: () => boolean;
  isConnectedPin: (pinNumber: string | number) => boolean;
  setForcedPinNumber: (value: string | number | null) => void;
  setSkippedPinNumbers: (value: Array<string | number>) => void;
  setHighlightedPin: (value: PinInfo | null) => void;
};

export const createPinFlowActions = ({
  getCurrentPartKey,
  getCurrentPartPins,
  getNextPinToPlace,
  getHighlightedPin,
  getForcedPinNumber,
  getSkippedPinNumbers,
  getHideDisconnectedPins,
  isConnectedPin,
  setForcedPinNumber,
  setSkippedPinNumbers,
  setHighlightedPin
}: PinFlowDeps) => {
  const applySelection = (next: {
    forcedPinNumber: string | number | null;
    skippedPinNumbers: Array<string | number>;
    highlightedPin: PinInfo | null;
  } | null) => {
    if (!next) return;
    setForcedPinNumber(next.forcedPinNumber);
    setSkippedPinNumbers(next.skippedPinNumbers);
    setHighlightedPin(next.highlightedPin);
  };

  const resolveActivePinNumber = () => {
    return getHighlightedPin()?.pinNumber ?? getNextPinToPlace()?.pinNumber ?? null;
  };

  const selectPinToPlace = (pinNumber: string | number) => {
    applySelection(selectPin({
      pinNumber,
      currentPartKey: getCurrentPartKey(),
      hideDisconnectedPins: getHideDisconnectedPins(),
      isConnectedPin,
      skippedPinNumbers: getSkippedPinNumbers()
    }));
  };

  const skipWithPredicate = (predicate: (pin: PinEntry) => boolean) => {
    const pinNumber = resolveActivePinNumber();
    if (pinNumber == null) return;
    applySelection(skipPin({
      pinNumber,
      currentPartKey: getCurrentPartKey(),
      currentPartPins: getCurrentPartPins(),
      forcedPinNumber: getForcedPinNumber(),
      skippedPinNumbers: getSkippedPinNumbers(),
      predicate
    }));
  };

  return {
    selectPinToPlace,
    skipNextPin: () => skipWithPredicate(() => true),
    skipToNextConnectedPin: () => skipWithPredicate((pin) => isConnectedPin(pin.pinNumber))
  };
};
