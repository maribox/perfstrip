import type { Part } from "xtoedif";
import { kicad_drawing_map } from "$lib/kicad_fritzing_map";
import { convertKicadToParts, parseKiCad } from "xtoedif";

export interface InitializedData {
  parts: Record<string, Part>;
  parsedKiCadDoc: any;
  placedParts: App.PlacedPart[];
}

export function initializeFromSpice(spice: string | null): InitializedData {
  if (!spice) {
    return {
      parts: {},
      parsedKiCadDoc: null,
      placedParts: []
    };
  }

  try {
    const parsedKiCadDoc = parseKiCad(spice);
    const parts = convertKicadToParts(spice);
    
    // Pre-process pin information and network data into parts
    preprocessPartPinsAndNetworks(parts, parsedKiCadDoc);
    
    const placedParts: App.PlacedPart[] = [];
    let partI = -1;
    for (let [partKey, part] of Object.entries(parts)) {
      partI++;
      placedParts.push({
        position: [2, partI * 2],
        width: 100,
        height: 100,
        image: kicad_drawing_map[part.comp.footprint.split(":")[0]] ?? ["fritzing_parts", "resistor_220"],
        part: part,
      });
    }

    return {
      parts,
      parsedKiCadDoc,
      placedParts
    };
  } catch (error) {
    console.error("Failed to parse SPICE file:", error);
    return {
      parts: {},
      parsedKiCadDoc: null,
      placedParts: []
    };
  }
}

function preprocessPartPinsAndNetworks(parts: Record<string, Part>, parsedKiCadDoc: any): void {
  if (!parsedKiCadDoc) return;

  // First pass: collect pin definitions from libparts
  Object.entries(parts).forEach(([partKey, part]) => {
    // Try to find the libpart - try multiple matching strategies
    const libpart = Object.values(parsedKiCadDoc.libparts).find((lp: any) => {
      // Try direct value match
      if (lp.part === part.comp.value) return true;
      // Try lib:part format
      if (lp.lib && lp.part && (lp.lib + ":" + lp.part) === part.comp.value) return true;
      // Try footprint match as fallback
      if (part.comp.footprint && lp.footprint === part.comp.footprint) return true;
      return false;
    });
    
    if (libpart && (libpart as any).pins) {
      part.pins = (libpart as any).pins.map((pin: any) => ({
        pinNumber: pin.pinNumber || pin.num || pin.ref || pin.pin,
        name: pin.name || pin.pinfunction || pin.function || `Pin${pin.pinNumber || pin.num || pin.ref || pin.pin}`,
        pinFunction: pin.pinfunction || pin.function,
        pinType: pin.pintype || pin.type,
        netCode: undefined
      }));
    } else {
      // If no libpart found, create default pins based on netRefs count
      const pinCount = part.netRefs.length || part.pinCount || 2;
      part.pins = Array.from({ length: pinCount }, (_, i) => ({
        pinNumber: i + 1,
        name: `Pin${i + 1}`,
        pinFunction: undefined,
        pinType: undefined,
        netCode: undefined
      }));
    }
  });

  // Second pass: add network codes to pins
  parsedKiCadDoc.nets.forEach((net: any) => {
    net.connections.forEach((connection: any) => {
      const part = parts[connection.ref];
      if (part && part.pins) {
        const pinNum = connection.pinNumber || connection.pin;
        const pin = part.pins.find(p => p.pinNumber == pinNum);
        if (pin) {
          pin.netCode = net.code;
        }
      }
    });
  });
}
