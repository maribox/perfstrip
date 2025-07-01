import type { Part, PinPosition, PartPin } from "xtoedif";
import type { NetworkInfo } from "$lib/types";

export function getNetworkForPin(
  parts: Record<string, Part>,
  partKey: string,
  pinNumber: string | number,
  parsedKiCadDoc?: any
): NetworkInfo | null {
  const part = parts[partKey];
  if (!part?.pins) return null;
  
  const pin = part.pins.find(p => p.pinNumber == pinNumber);
  if (!pin?.netCode) return null;
  
  // Get the actual net name from the parsed KiCad document
  let netName = `Net${pin.netCode}`;
  if (parsedKiCadDoc?.nets) {
    const net = parsedKiCadDoc.nets.find((n: any) => n.code === pin.netCode);
    if (net?.name) {
      netName = net.name;
    }
  }
  
  // Build network info from the netCode
  const connectedComponents: Array<{
    ref: string;
    name: string;
    pinNumber: string | number;
    pinFunction?: string;
  }> = [];
  
  // Find all other parts connected to the same network
  Object.entries(parts).forEach(([otherPartKey, otherPart]) => {
    if (otherPart.pins) {
      otherPart.pins.forEach(otherPin => {
        if (otherPin.netCode === pin.netCode) {
          connectedComponents.push({
            ref: otherPartKey,
            name: otherPart.name,
            pinNumber: otherPin.pinNumber,
            pinFunction: otherPin.pinFunction
          });
        }
      });
    }
  });
  
  return {
    netName,
    netCode: pin.netCode,
    connectedComponents
  };
}

export function getCurrentPartPins(
  parts: Record<string, Part>,
  currentPartKey: string,
  selectedPins: PinPosition[]
): Array<PartPin & { isPlaced: boolean }> {
  const part = parts[currentPartKey];
  if (!part?.pins) return [];
  
  return part.pins.map(pin => ({
    ...pin,
    isPlaced: selectedPins.some(sp => sp.pinNumber == pin.pinNumber)
  }));
}
