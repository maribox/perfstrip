import type { Part, PinPosition } from "xtoedif";
import { kicad_drawing_map } from "$lib/kicad_fritzing_map";
import { convertKicadToParts, parseKiCad, matchFootprint } from "xtoedif";

export interface InitializedData {
  parts: Record<string, Part>;
  parsedKiCadDoc: any;
  placedParts: App.PlacedPart[];
}

const createEmptyData = (): InitializedData => ({
  parts: {},
  parsedKiCadDoc: null,
  placedParts: []
});

export function initializeFromSpice(spice: string | null): InitializedData {
  if (!spice) {
    return createEmptyData();
  }

  try {
    const parsedKiCadDoc = parseKiCad(spice);
    const parts = convertKicadToParts(spice);

    // Pre-process pin information and network data into parts
    preprocessPartPinsAndNetworks(parts, parsedKiCadDoc);

    // Auto-generate footprints for parts that don't have one
    autoGenerateFootprints(parts);

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
    console.error("Failed to parse KiCad netlist:", error);
    return createEmptyData();
  }
}

function preprocessPartPinsAndNetworks(parts: Record<string, Part>, parsedKiCadDoc: any): void {
  if (!parsedKiCadDoc) return;

  // First pass: collect pin definitions from libparts
  Object.entries(parts).forEach(([partKey, part]) => {
    // Find the libpart - the libparts map is keyed by part name (indexBy strips the key)
    const libpartEntry = Object.entries(parsedKiCadDoc.libparts).find(([partName, lp]: [string, any]) => {
      // Try direct value match (e.g., "ESP32-WROOM-32" === "ESP32-WROOM-32")
      if (partName === part.comp.value) return true;
      // Try lib:part format (e.g., "RF_Module:ESP32-WROOM-32")
      if (lp.lib && (lp.lib + ":" + partName) === part.comp.value) return true;
      // Try description match as fallback
      if (part.comp.description && lp.description === part.comp.description) return true;
      return false;
    });
    const libpart = libpartEntry?.[1];

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

/**
 * Auto-generate footprints for parts that don't have one.
 * First checks KNOWN_FOOTPRINTS via matchFootprint(), then falls back to generic layouts:
 * - 1-8 pins: single row (1xN)
 * - 9+ pins: DIP layout (2 parallel columns)
 */
function autoGenerateFootprints(parts: Record<string, Part>): void {
  for (const [partKey, part] of Object.entries(parts)) {
    if (part.footprint) continue;
    if (!part.pins || part.pins.length === 0) continue;

    const known = matchFootprint(part);
    if (known) {
      part.footprint = known;
      continue;
    }

    const pinCount = part.pins.length;
    const pins: PinPosition[] = [];

    if (pinCount <= 8) {
      // Single row layout
      for (let i = 0; i < pinCount; i++) {
        pins.push({
          x: i,
          y: 0,
          pinNumber: part.pins[i].pinNumber,
          name: part.pins[i].name,
        });
      }
      part.footprint = {
        name: `${pinCount}-Pin Row`,
        layout: { type: "fixed", pins },
      };
    } else {
      // DIP layout: 2 columns
      const halfPins = Math.ceil(pinCount / 2);
      const dipWidth = 2;
      // Left column: pins go down
      for (let i = 0; i < halfPins; i++) {
        pins.push({
          x: 0,
          y: i,
          pinNumber: part.pins[i].pinNumber,
          name: part.pins[i].name,
        });
      }
      // Right column: pins go up (DIP convention)
      for (let i = halfPins; i < pinCount; i++) {
        const rightIdx = i - halfPins;
        pins.push({
          x: dipWidth,
          y: halfPins - 1 - rightIdx,
          pinNumber: part.pins[i].pinNumber,
          name: part.pins[i].name,
        });
      }
      part.footprint = {
        name: `DIP-${pinCount}`,
        layout: { type: "fixed", pins },
      };
    }
  }
}
