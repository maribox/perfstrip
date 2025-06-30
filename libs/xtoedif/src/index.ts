import { parseKiCad, type KiCadExport } from "./kicadparsers.js";

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
}

export type Footprint = { 
  name: string;
  layout: FixedFootprint | VariableFootprint;
}

export type PartType = "Resistor" | "Board" | "Transistor"

export const DEFAULT_FOOTPRINTS: Partial<Record<PartType, Footprint>> = {
  "Resistor": {
    name: "2-Pin Resistor",
    layout: {
      type: "variable",
      minLength: 3,
      maxLength: 10
    }
  },
  "Transistor": {
    name: "TO220 Transistor",
    layout: {
      type: "fixed",
      pins: [
        { x: 0, y: 0, pinNumber: 1, name: "G" },
        { x: 1, y: 0, pinNumber: 2, name: "S" },
        { x: 2, y: 0, pinNumber: 3, name: "D" }
      ]
    }
  }
};

export type Part = {comp: KiCadComponent, name: string, description: string, type?: PartType, netRefs: number[], pinCount: number, footprint?: Footprint}

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
        parts[connection.ref] = {
          comp: doc.components[connection.ref],
          name: doc.components[connection.ref].value ?? `Unknown ${doc.libparts[connection.ref].pins.length}-pinned Part`,
          footprint: partType && DEFAULT_FOOTPRINTS[partType] ? DEFAULT_FOOTPRINTS[partType] : undefined,
          type: partType,
          description: description,
          netRefs: [],
          pinCount: 0
        }
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