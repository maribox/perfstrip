import { parse as parseSexpr, Expression, ASTNode, Root, Sym } from "@thi.ng/sexpr";
import { Type, Static, TObject, TArray, TSchema } from "@sinclair/typebox";
import AjvBase from "ajv";

const Pin = Type.Object({
  ref: Type.Optional(Type.String()),
  pinNumber: Type.Optional(Type.Number()),
  name: Type.Optional(Type.String()),
  pintype: Type.Optional(Type.String()),
  pinfunction: Type.Optional(Type.String()),
});

const Field = Type.Object({ name: Type.String(), value: Type.Optional(Type.Union([Type.String(), Type.Number()])) });
const Net = Type.Object({ code: Type.String(), name: Type.String(), class: Type.String(), connections: Type.Array(Pin) });
const Design = Type.Object({ source: Type.Optional(Type.String()), date: Type.Optional(Type.String()), tool: Type.Optional(Type.String()) });

const Component = Type.Object({
  ref: Type.String(),
  value: Type.Optional(Type.String()),
  footprint: Type.Optional(Type.String()),
  datasheet: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  fields: Type.Array(Field),
  properties: Type.Array(Field),
});

const Libpart = Type.Object({
  lib: Type.String(),
  part: Type.String(),
  description: Type.Optional(Type.String()),
  docs: Type.Optional(Type.String()),
  footprints: Type.Array(Type.String()),
  fields: Type.Array(Field),
  pins: Type.Array(Pin),
});

const Library = Type.Object({ logical: Type.String(), uri: Type.String() });

const ExportSchema = Type.Object({
  version: Type.String(),
  design: Design,
  components: Type.Array(Component),
  libparts: Type.Array(Libpart),
  libraries: Type.Array(Library),
  nets: Type.Array(Net),
});

export type KiCadExport = Static<typeof ExportSchema>;

const ALIAS: Record<string, string> = {
  comp: "components", libpart: "libparts", library: "libraries", net: "nets",
  field: "fields", property: "properties", fp: "footprints", pin: "pins", node: "connections",
  num: "pinNumber", type: "pintype",
};

const ajv = new ((AjvBase as any).default ?? AjvBase)({ coerceTypes: true, allErrors: true });
const validate = ajv.compile(ExportSchema);

const isExpr = (n?: ASTNode): n is Expression => n?.type === "expr";
const isLit = (n?: ASTNode) => n?.type === "str" || n?.type === "num";
const litValue = (n?: ASTNode) => (n?.type === "str" || n?.type === "num") ? (n as any).value : undefined;

function sexprToJson(expr: Expression): Record<string, any> {
  const obj: Record<string, any> = {};

  for (const child of expr.children.filter(isExpr)) {
    const key = (child.children[0] as Sym).value;
    const value = child.children.some(isExpr)
      ? sexprToJson(child)
      : litValue(child.children.find(isLit));
    if (value !== undefined)
      obj[key] = obj[key] ? [].concat(obj[key], value) : value;
  }

  const trailing = litValue([...expr.children].reverse().find(isLit));
  if (trailing !== undefined) obj.value = trailing;

  return obj;
}


function lookup(raw: any, schemaKey: string): unknown {
  if (raw?.[schemaKey] !== undefined) return raw[schemaKey];           // perfect match
  if (schemaKey === "pinNumber" && raw?.pin !== undefined) return raw.pin; // hybrid pin form
  for (const [rawKey, canonical] of Object.entries(ALIAS))
    if (canonical === schemaKey && raw?.[rawKey] !== undefined) return raw[rawKey];
  return undefined;
}

function coerce(schema: TSchema, raw: unknown): unknown {

  if (schema.type === "array") {
    const item = (schema as TArray).items;
    if (raw === undefined) return [];
    if (!Array.isArray(raw) && typeof raw === "object") {
      const onlyValue = Object.values(raw as any);
      if (onlyValue.length === 1) raw = onlyValue[0];
    }
    const arr = Array.isArray(raw) ? raw : [raw];
    return arr.map(r => coerce(item, r));
  }

  if (schema.type === "object") {
    const props = (schema as TObject).properties;
    const obj: Record<string, any> = {};
    for (const key of Object.keys(props))
      obj[key] = coerce(props[key], lookup(raw, key));
    return obj;
  }

  if (schema.type === "string") return raw !== undefined ? String(raw) : "";
  if (schema.type === "number") return raw !== undefined ? Number(raw) : 0;
  if (schema.type === "boolean") return raw !== undefined ? Boolean(raw) : false;
  return raw;
}


export function parseKiCad(src: string): KiCadExport {
  const root = parseSexpr(src) as Root;

  const exportExpr = root.children.find(
    (n): n is Expression => isExpr(n) && (n.children[0] as Sym).value === "export",
  );
  if (!exportExpr) throw new Error("`(export …)` section not found");

  const raw = sexprToJson(exportExpr);
  const shaped = coerce(ExportSchema, raw) as KiCadExport;

  if (!validate(shaped))
    throw new Error("KiCad schema error:\n" + ajv.errorsText(validate.errors, { separator: "\n" }));

  return shaped;
}
