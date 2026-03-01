import { parseKiCad, type KiCadExport } from "./kicadparsers.js";

export { parseKiCad };
export type KiCadComponent = KiCadExport["components"][string];

export type PinPosition = {
  x: number; 
  y: number; 
  pinNumber: string | number;
  name?: string; // e.g. for MOSFETS - can be G S and D
}

export type VariableFootprint = {
  type: "variable";
  minLength?: number; // in grid units, if not specified it's 1 (cannot place multiple in the same hole)
  maxLength?: number;
}

export type FixedFootprint = {
  type: "fixed";
  pins: PinPosition[];
  width?: number;   // explicit footprint width (overrides pin-based calculation)
  height?: number;  // explicit footprint height (overrides pin-based calculation)
}

export type Footprint = { 
  name: string;
  layout: FixedFootprint | VariableFootprint;
}

export type PartType = "Resistor" | "Board" | "Transistor"

// ─── Centralized Footprint Registry ───

export const KNOWN_FOOTPRINTS: Record<string, Footprint> = {
  "2-Pin Resistor": {
    name: "2-Pin Resistor",
    layout: { type: "variable", minLength: 4, maxLength: 10 },
  },
  "TO220 Transistor": {
    name: "TO220 Transistor",
    layout: {
      type: "fixed",
      pins: [
        { x: 0, y: 0, pinNumber: 1, name: "G" },
        { x: 1, y: 0, pinNumber: 2, name: "S" },
        { x: 2, y: 0, pinNumber: 3, name: "D" },
      ],
    },
  },
  "ESP32 DevKit": {
    name: "ESP32 DevKit",
    layout: {
      type: "fixed",
      pins: [
        // Left header (top=USB end, going down)
        { x: 0, y: 0, pinNumber: 2, name: "3V3" },
        { x: 0, y: 1, pinNumber: 1, name: "GND" },
        { x: 0, y: 2, pinNumber: 23, name: "D15" },
        { x: 0, y: 3, pinNumber: 24, name: "D2" },
        { x: 0, y: 4, pinNumber: 26, name: "D4" },
        { x: 0, y: 5, pinNumber: 27, name: "D16" },
        { x: 0, y: 6, pinNumber: 28, name: "D17" },
        { x: 0, y: 7, pinNumber: 29, name: "D5" },
        { x: 0, y: 8, pinNumber: 30, name: "D18" },
        { x: 0, y: 9, pinNumber: 31, name: "D19" },
        { x: 0, y: 10, pinNumber: 33, name: "D21" },
        { x: 0, y: 11, pinNumber: 34, name: "RX0" },
        { x: 0, y: 12, pinNumber: 35, name: "TX0" },
        { x: 0, y: 13, pinNumber: 36, name: "D22" },
        { x: 0, y: 14, pinNumber: 37, name: "D23" },
        // Right header (top=USB end, going down)
        { x: 10, y: 0, pinNumber: "VIN", name: "VIN" },
        { x: 10, y: 1, pinNumber: 38, name: "GND" },
        { x: 10, y: 2, pinNumber: 16, name: "D13" },
        { x: 10, y: 3, pinNumber: 14, name: "D12" },
        { x: 10, y: 4, pinNumber: 13, name: "D14" },
        { x: 10, y: 5, pinNumber: 12, name: "D27" },
        { x: 10, y: 6, pinNumber: 11, name: "D26" },
        { x: 10, y: 7, pinNumber: 10, name: "D25" },
        { x: 10, y: 8, pinNumber: 9, name: "D33" },
        { x: 10, y: 9, pinNumber: 8, name: "D32" },
        { x: 10, y: 10, pinNumber: 7, name: "D35" },
        { x: 10, y: 11, pinNumber: 6, name: "D34" },
        { x: 10, y: 12, pinNumber: 5, name: "VN" },
        { x: 10, y: 13, pinNumber: 4, name: "VP" },
        { x: 10, y: 14, pinNumber: 3, name: "EN" },
      ],
    },
  },
};

// Maps PartType → footprint name in KNOWN_FOOTPRINTS
const PART_TYPE_FOOTPRINT_MAP: Partial<Record<PartType, string>> = {
  "Resistor": "2-Pin Resistor",
  "Transistor": "TO220 Transistor",
};

// Maps substring in comp.value → footprint name in KNOWN_FOOTPRINTS
const VALUE_FOOTPRINT_MAP: [string, string][] = [
  ["ESP32", "ESP32 DevKit"],
];

export function matchFootprint(part: Part): Footprint | undefined {
  // 1. Match by PartType
  if (part.type) {
    const fpName = PART_TYPE_FOOTPRINT_MAP[part.type];
    if (fpName && KNOWN_FOOTPRINTS[fpName]) return KNOWN_FOOTPRINTS[fpName];
  }
  // 2. Match by comp.value substring
  const value = part.comp.value ?? "";
  for (const [pattern, fpName] of VALUE_FOOTPRINT_MAP) {
    if (value.includes(pattern)) return KNOWN_FOOTPRINTS[fpName];
  }
  // 3. Screw terminals: pins spaced 2 apart, centered in 3-row grid
  const screwMatch = value.match(/Screw_Terminal_\d+x(\d+)/);
  if (screwMatch) {
    const n = parseInt(screwMatch[1], 10);
    const pins: PinPosition[] = [];
    for (let i = 0; i < n; i++) {
      pins.push({ x: 2 * i + 1, y: 1, pinNumber: i + 1, name: `${i + 1}` });
    }
    return { name: `Screw Terminal ${n}-Pin`, layout: { type: "fixed", pins, width: 2 * n + 1, height: 3 } };
  }
  return undefined;
}

/** @deprecated Use KNOWN_FOOTPRINTS + matchFootprint() instead */
export const DEFAULT_FOOTPRINTS = KNOWN_FOOTPRINTS;

export interface PartPin {
  pinNumber: string | number;
  name: string;
  pinFunction?: string;
  pinType?: string;
  netCode?: number;
}

export type Part = {
  comp: KiCadComponent, 
  name: string, 
  description: string, 
  type?: PartType, 
  netRefs: number[], 
  pinCount: number, 
  footprint?: Footprint,
  pins?: PartPin[]
}

function getPartTypeFromDescription(description?: string): PartType | undefined {
  if (!description) return undefined;
  
  switch (true) {
    case description === "Resistor":
      return "Resistor";
    case description.includes("MOSFET"):
      return "Transistor";
    case description.includes("RF Module"):
      return "Board";
    default:
      return undefined;
  }
}


export function convertKicadToParts(netlistContent: string): Record<string, Part> {
  const doc = parseKiCad(netlistContent);
  console.log(doc)
  let parts : Record<string, Part> = {}
  
  for (let net of doc.nets) {
    for (let connection of net.connections) {
      if (!parts[connection.ref]) {
        const description = doc.components[connection.ref].description ?? "Unknown";
        const partType = getPartTypeFromDescription(description);
        const part: Part = {
          comp: doc.components[connection.ref],
          name: doc.components[connection.ref].value ?? `Unknown ${doc.libparts[connection.ref].pins.length}-pinned Part`,
          footprint: undefined,
          type: partType,
          description: description,
          netRefs: [],
          pinCount: 0
        };
        part.footprint = matchFootprint(part);
        parts[connection.ref] = part;
      }
      parts[connection.ref].pinCount++;
      parts[connection.ref].netRefs.push(net.code);
    }
  } 

  return parts
}


export function convertEagleToEdif(netlistContent: string): string {
  throw new Error('Not implemented yet');
}