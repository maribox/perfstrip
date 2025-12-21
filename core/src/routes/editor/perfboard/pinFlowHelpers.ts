import type { ComponentBody, PinInfo, PinPosition } from "$lib/types";

type PinEntry = { pinNumber: string | number; isPlaced: boolean };

export const findNextUnplacedPin = (
  pins: PinEntry[],
  afterPinNumber: string | number,
  predicate: (pin: PinEntry) => boolean = () => true
) => {
  const startIndex = pins.findIndex((pin) => pin.pinNumber == afterPinNumber);
  const afterList = startIndex >= 0 ? pins.slice(startIndex + 1) : pins;
  return (
    afterList.find((pin) => !pin.isPlaced && predicate(pin)) ??
    pins.find((pin) => !pin.isPlaced && predicate(pin)) ??
    null
  );
};

export const selectPin = ({
  pinNumber,
  currentPartKey,
  hideDisconnectedPins,
  isConnectedPin,
  skippedPinNumbers
}: {
  pinNumber: string | number;
  currentPartKey: string | null;
  hideDisconnectedPins: boolean;
  isConnectedPin: (pinNumber: string | number) => boolean;
  skippedPinNumbers: Array<string | number>;
}): {
  forcedPinNumber: string | number;
  skippedPinNumbers: Array<string | number>;
  highlightedPin: PinInfo | null;
} | null => {
  if (!currentPartKey) return null;
  if (hideDisconnectedPins && !isConnectedPin(pinNumber)) return null;
  return {
    forcedPinNumber: pinNumber,
    skippedPinNumbers: skippedPinNumbers.filter((p) => p != pinNumber),
    highlightedPin: { partKey: currentPartKey, pinNumber }
  };
};

export const skipPin = ({
  pinNumber,
  currentPartKey,
  currentPartPins,
  forcedPinNumber,
  skippedPinNumbers,
  predicate
}: {
  pinNumber: string | number;
  currentPartKey: string | null;
  currentPartPins: PinEntry[];
  forcedPinNumber: string | number | null;
  skippedPinNumbers: Array<string | number>;
  predicate: (pin: PinEntry) => boolean;
}): {
  forcedPinNumber: string | number | null;
  skippedPinNumbers: Array<string | number>;
  highlightedPin: PinInfo | null;
} => {
  const nextSkipped = skippedPinNumbers.some((p) => p == pinNumber)
    ? skippedPinNumbers
    : [...skippedPinNumbers, pinNumber];
  const nextForced = forcedPinNumber != null && pinNumber == forcedPinNumber ? null : forcedPinNumber;
  const nextPin = findNextUnplacedPin(currentPartPins, pinNumber, predicate);
  return {
    forcedPinNumber: nextForced,
    skippedPinNumbers: nextSkipped,
    highlightedPin: nextPin && currentPartKey ? { partKey: currentPartKey, pinNumber: nextPin.pinNumber } : null
  };
};

export const cleanupSkippedPins = ({
  selectedPins,
  skippedPinNumbers,
  forcedPinNumber
}: {
  selectedPins: PinPosition[];
  skippedPinNumbers: Array<string | number>;
  forcedPinNumber: string | number | null;
}) => {
  const placed = new Set(selectedPins.map(pin => pin.pinNumber));
  const nextSkipped = skippedPinNumbers.filter(pin => !placed.has(pin));
  const nextForced = forcedPinNumber != null && placed.has(forcedPinNumber) ? null : forcedPinNumber;
  return { skippedPinNumbers: nextSkipped, forcedPinNumber: nextForced };
};

export const computeAutoBodies = (selectedPins: PinPosition[]): ComponentBody[] => {
  if (selectedPins.length === 0) return [];
  const xs = selectedPins.map(pin => pin.x);
  const ys = selectedPins.map(pin => pin.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return [{ x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }];
};
