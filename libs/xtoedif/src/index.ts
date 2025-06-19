import { parseKiCad, type KiCadExport } from "./kicadparsers.js";

export type KiCadComponent = KiCadExport["components"][string];
export type Part = {comp: KiCadComponent, netRefs: number[], pinCount: number}


export function convertKicadToParts(netlistContent: string): Record<string, Part> {
  const doc = parseKiCad(netlistContent);
  
  let parts : Record<string, Part> = {}
  
  for (let net of doc.nets) {
    for (let connection of net.connections) {
      if (!parts[connection.ref]) {
        parts[connection.ref] = {
          comp: doc.components[connection.ref],
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