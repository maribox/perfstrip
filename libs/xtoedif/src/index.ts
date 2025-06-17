import { parse, ASTNode, Root, Expression, INode, Sym } from "@thi.ng/sexpr";
import ASTQ from 'astq';
import { flatten } from "flat";

function transformASTToObject(node: ASTNode): any {
  switch (node.type) {
    case "root":
      return node.children.map((child) => transformASTToObject(child))
    case "expr":
      if (!node.children || node.children.length === 0 || node.children[0].type !== "sym") {
        throw new Error("invalid file")
      }
      /*
      (pins
          (pin (num "1") (name "Pin_1") (type "passive"))
          (pin (num "2") (name "Pin_2") (type "passive"))
          (pin (num "3") (name "Pin_3") (type "passive"))
          (pin (num "4") (name "Pin_4") (type "passive")))
       */
      // for leaf nodes:
      if (node.children.length == 2 && node.children[1].type == 'str') {
        return { [(node.children[0] as Sym).value]: node.children[1].value }
      }

      /* This is a bit hacky, but we either do this or our data will be super hard to traverse and handle.
      We flatten all the objects into one, 2 levels deep.
      
      Arrays are sometimes mixed with cons that only carry a value like (name "Pin_2").
      We would therefore need either of two things:
        - If children have all the same sym value (as above with pins), we could put them into one array and just return that array
          to the parent 'pins' (here with the object { num: "1", name: "Pin_1", type: "passive" } )
        - If some children have a different sym value, we could put only these into a separate array and use the rest as fields,    but if only one child would exist thats normally an array, then we would return it not as an array but as a single element.
          This would mean that we would create arrays or non arrays based on the count of elements instead of if there actually can be multiple of these (imagine only one pin -> instead pins being an array of pin objects, we would have pins being an object with the key "pin").
          So when traversing that data we would have to check for each element if it's an array or not, which is super annoying
        
        There is also super weird stuff where a cons is structured completely differently than other fields:
          (field (name "Reference") "R")
        This means "R", which should really be (value "R") does not have a key we can use to save it into an object.
        So we would have to make a special case here to use the value of "name" as a key for the cons with the sym 'field'...
        
        So we will just treat every field as an array, numbering them with the 'flat' library like 0.fieldname, then
        it doesn't matter if there are multiple or only one, we will always find the right one with x.fieldname, so we can filter with split(".")[-1] === fieldname.
      */

      let sym = (node.children[0] as Sym).value
      let transformedChildren = node.children.slice(1).map(child => transformASTToObject(child))
      return { [sym]: flatten(transformedChildren, { maxDepth: 2 }) }
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

  const nets = Object.entries(transformASTToObject(ast)[0]["export"]).find(([key, value]) => key.endsWith('.nets'))?.[1];
  console.log(nets)

  return ""
}


export function convertEagleToEdif(netlistContent: string): string {
  throw new Error('Not implemented yet');
}