import { parse, ASTNode, Root, Expression, INode, Sym } from "@thi.ng/sexpr";
import typia from "typia";
import { parseKiCad } from "./kicadparsers.js";

export type PartType = "resistor" | ""

export interface Part {
  ref: string,
  pins: Map<number, Pin>
  type?: PartType,
}

export interface Pin {
  ref: string;
  pinNumber: number;
  pintype?: string;
  pinfunction?: string;
}

export interface Net {
  code: string;
  name: string;
  class: string;
  connections: Pin[];
}

export function convertKicadToEdif(netlistContent: string): string {
  const doc = parseKiCad(netlistContent);
  console.log(doc);

  let parts : Record<string, Part> = {}
  

  //console.log(parts);
  

  return ""
}


export function convertEagleToEdif(netlistContent: string): string {
  throw new Error('Not implemented yet');
} 