import { parse, ASTNode, Root, Expression, INode, Sym } from "@thi.ng/sexpr";
import typia from "typia";

export interface Part {
  ref: string;
  pin: number;
  pintype: string;
  pinfunction?: string;
}

export interface Net {
  code: string;
  name: string;
  class: string;
  parts: Part[];
}

export function convertKicadToEdif(netlistContent: string): string {
  const ast = parse(netlistContent);
  const netsRaw = ((ast.children[0] as Expression).children.find(child =>
    child.type === "expr" &&
    child.children &&
    child.children[0] &&
    child.children[0].type == 'sym' &&
    (child.children[0] as Sym).value === "nets"
  ) as Expression).children.slice(1)

  // Access the nets children, i.e. all the nets under the "nets" block
  const mapped = netsRaw.map((netExpr: any) => {
    const [, codeExpr, nameExpr, classExpr, ...nodeExprs] = netExpr.children
    const code = codeExpr.children[1].value as string
    const name = nameExpr.children[1].value as string
    const cls = classExpr.children[1].value as string

    const parts: Part[] = nodeExprs.map((p: any) => {
      const [, refExpr, pinExpr, ...attrs] = p.children
      const ref = refExpr.children[1].value as string
      const pin = Number(pinExpr.children[1].value)
      let pintype = '', pinfunction: string | undefined

      for (const a of attrs) {
        const key = a.children[0].value
        const val = a.children[1].value
        if (key === 'pintype') pintype = val
        else if (key === 'pinfunction') pinfunction = val
      }

      return { ref, pin, pintype, pinfunction }
    })

    return { code, name, class: cls, parts }
  })

  const nets = typia.assert<Net[]>(mapped)
  console.log(nets);

  return ""
}


export function convertEagleToEdif(netlistContent: string): string {
  throw new Error('Not implemented yet');
}