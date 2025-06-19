import { parse as parseSexpr, Expression, ASTNode, Root, Sym, } from "@thi.ng/sexpr";
import { Type, Static, TObject, TArray, TSchema, } from "@sinclair/typebox";
import AjvRaw from "ajv";

const Pin = Type.Object({
  ref: Type.String(),
  pinNumber: Type.Optional(Type.Number()),
  name: Type.Optional(Type.String()),
  pintype: Type.Optional(Type.String()),
  pinfunction: Type.Optional(Type.String()),
});

const Field = Type.Object({
  name: Type.String(),
  value: Type.Optional(Type.Union([Type.String(), Type.Number()])),
});

const Net = Type.Object({
  code: Type.Number(),
  name: Type.String(),
  class: Type.String(),
  connections: Type.Array(Pin),
});

const Design = Type.Object({
  source: Type.Optional(Type.String()),
  date: Type.Optional(Type.String()),
  tool: Type.Optional(Type.String()),
});

const ComponentBase = Type.Object({
  ref: Type.String(),
  value: Type.Optional(Type.String()),
  footprint: Type.Optional(Type.String()),
  datasheet: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  fields: Type.Array(Field),
  properties: Type.Array(Field),
});

const LibpartBase = Type.Object({
  lib: Type.String(),
  part: Type.String(),
  description: Type.Optional(Type.String()),
  docs: Type.Optional(Type.String()),
  footprints: Type.Array(Type.String()),
  fields: Type.Array(Field),
  pins: Type.Array(Pin),
});

const LibraryBase = Type.Object({
  logical: Type.String(),
  uri: Type.String(),
});

const ExportSchema = Type.Object({
  version: Type.String(),
  design: Design,
  components: Type.Array(ComponentBase),
  libparts: Type.Array(LibpartBase),
  libraries: Type.Array(LibraryBase),
  nets: Type.Array(Net),
});

type ArrayExport = Static<typeof ExportSchema>;

type Strip<T, K extends keyof T> = Omit<T, K>;

export type Components = Record<string, Strip<Static<typeof ComponentBase>, "ref">>
export type Libparts = Record<string, Strip<Static<typeof LibpartBase>, "part">>
export type Libraries = Record<string, Strip<Static<typeof LibraryBase>, "logical">>

export interface KiCadExport {
  version: string;
  design: Static<typeof Design>;
  components: Components;
  libparts: Libparts;
  libraries: Libraries;
  nets: Static<typeof Net>[];
}

const Ajv = (AjvRaw as any).default ?? AjvRaw;
const ajv = new Ajv({ coerceTypes: true, allErrors: true });
const validate = ajv.compile(ExportSchema);

const KEY_MAP: Record<string, string> = {
  comp: "components",
  libpart: "libparts",
  library: "libraries",
  net: "nets",
  field: "fields",
  property: "properties",
  fp: "footprints",
  pin: "pins",
  node: "connections",
  num: "pinNumber",
  type: "pintype",
};

const isExpr = (n?: ASTNode): n is Expression => n?.type === "expr";
const isLit = (n?: ASTNode) => n?.type === "str" || n?.type === "num";
const litVal = (n?: ASTNode) => (isLit(n) ? (n as any).value : undefined);

const exprToObj = (expr: Expression): Record<string, unknown> => {
  const out: Record<string, unknown> = {};

  for (const c of expr.children.filter(isExpr)) {
    const key = (c.children[0] as Sym).value;
    const value =
      c.children.some(isExpr) ? exprToObj(c) : litVal(c.children.find(isLit));

    if (value !== undefined) {
      out[key] = out[key] ? ([] as unknown[]).concat(out[key], value) : value;
    }
  }

  const trailing = litVal([...expr.children].reverse().find(isLit));
  if (trailing !== undefined) out.value = trailing;

  return out;
};

const resolve = (raw: any, key: string): unknown => {
  if (raw?.[key] !== undefined) return raw[key];
  if (key === "pinNumber" && raw?.pin !== undefined) return raw.pin;

  for (const [rawKey, canonical] of Object.entries(KEY_MAP)) {
    if (canonical === key && raw?.[rawKey] !== undefined) return raw[rawKey];
  }
  return undefined;
};

const conform = (schema: TSchema, raw: unknown): unknown => {
  switch (schema.type) {
    case "array": {
      const itemSchema = (schema as TArray).items;

      if (raw === undefined) return [];

      if (!Array.isArray(raw) && typeof raw === "object") {
        const only = Object.values(raw as Record<string, unknown>);
        if (only.length === 1) raw = only[0];
      }

      const list = Array.isArray(raw) ? raw : [raw];
      return list.map(el => conform(itemSchema, el));
    }

    case "object": {
      const props = (schema as TObject).properties;
      const result: Record<string, unknown> = {};

      for (const k of Object.keys(props)) {
        result[k] = conform(props[k], resolve(raw, k));
      }
      return result;
    }

    case "string":
      return raw !== undefined ? String(raw) : "";

    case "number":
      return raw !== undefined ? Number(raw) : 0;

    case "boolean":
      return raw !== undefined ? Boolean(raw) : false;
  }
  return raw;
};

const indexBy = <
  T extends Record<string, unknown>,
  K extends keyof T,
>(
  list: T[],
  key: K,
  label: string,
): Record<string, Strip<T, K>> => {
  const map: Record<string, Strip<T, K>> = {};

  for (const item of list) {
    const id = item[key] as unknown as string;
    if (!id) throw new Error(`missing ${String(key)} in ${label}`);
    if (map[id]) throw new Error(`duplicate ${String(key)} “${id}” in ${label}`);

    const { [key]: _, ...rest } = item;
    map[id] = rest as Strip<T, K>;
  }
  return map;
};

export function parseKiCad(src: string): KiCadExport {
  const root = parseSexpr(src) as Root;

  const exportExpr = root.children.find(
    (n): n is Expression => isExpr(n) && (n.children[0] as Sym).value === "export",
  );
  if (!exportExpr) throw new Error("no (export …) section");

  const raw = exprToObj(exportExpr);
  const shaped = conform(ExportSchema, raw) as ArrayExport;

  if (!validate(shaped)) {
    throw new Error(
      "KiCad schema error:\n" +
      ajv.errorsText(validate.errors, { separator: "\n" }),
    );
  }

  return {
    version: shaped.version,
    design: shaped.design,
    components: indexBy(shaped.components, "ref", "components"),
    libparts: indexBy(shaped.libparts, "part", "libparts"),
    libraries: indexBy(shaped.libraries, "logical", "libraries"),
    nets: shaped.nets,
  };
}
