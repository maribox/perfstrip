import type { Part, PinPosition, Footprint, PartPin } from "xtoedif";

export interface NetworkInfo {
  netName: string;
  netCode: number;
  connectedComponents: Array<{
    ref: string;
    name: string;
    pinNumber: string | number;
    pinFunction?: string;
  }>;
}

export interface PinInfo {
  partKey?: string;
  pinNumber: string | number;
  name?: string;
  pinFunction?: string;
}

export interface ComponentBody {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type FootprintLayout = 
  | { type: "fixed"; pins: PinPosition[] }
  | { type: "variable"; minLength: number; maxLength: number };

export interface VariableFootprintSettings {
  minLength: number;
  maxLength: number;
}

export interface FootprintEditState {
  partKeyQueue: string[];
  currentFootprint: Footprint;
}

export type OnEditFootprintFunction = (partKey: string) => void;
export type OnEditMultipleFootprintsFunction = (...partKeys: string[]) => void;
