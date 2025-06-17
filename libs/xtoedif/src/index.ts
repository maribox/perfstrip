import { parse, ASTNode, Root, Expression, INode, Sym } from "@thi.ng/sexpr";
import ASTQ from 'astq';

function transformASTToObject(node: ASTNode): any {
  switch (node.type) {
  case "root":
  return node.children.map((child) => transformASTToObject(child))
  case "expr":
    if (!node.children || node.children.length === 0 || node.children[0].type !== "sym") {
      throw new Error("invalid file")
    }
  return { [(node.children[0] as Sym).value] : node.children.slice(1).map(child => transformASTToObject(child))}
  case "num":
  case "str":
  case "sym":
  return node.value
  default:
  throw new Error("Imported library has an error.")
  }
}

export function convertKicadToEdif(netlistContent: string): string {
  const ast = parse(netlistContent);
  console.log(ast);
  
  const structured = transformASTToObject(ast);
  console.log(structured);

  return ""
}


export function convertEagleToEdif(netlistContent: string): string {
  throw new Error('Not implemented yet');
}