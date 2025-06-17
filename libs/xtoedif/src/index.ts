import { parse, ASTNode, Root, Expression, INode } from "@thi.ng/sexpr";
import ASTQ from 'astq';


export function convertKicadToEdif(netlistContent: string): string {
  const astq = new ASTQ();
    astq.adapter({
        taste: (node: any): boolean => node && typeof node === 'object' && 'type' in node,
        getParentNode: (node: INode): INode | undefined => {
            if (node.type === 'root') {
                return undefined;
            }
            return node.parent
        },
        getChildNodes: (node: INode): INode[] => {
            if ('children' in node && Array.isArray(node.children)) {
                return node.children;
            }
            return [];
        },
        getNodeType: (node: INode): string => node.type,
        getNodeAttrNames: (node: INode): string[] => Object.keys(node),
        getNodeAttrValue: (node: INode, attr: string): INode => (node as INode)[attr]
    });


  const nets = astq.query(parse(netlistContent), '/expr/ expr [ / sym [ @value == "nets" ]]')[0];
  console.log(nets);
  console.log(astq.query(nets, '/ expr / expr / str')) 
  

  return ""
}


export function convertEagleToEdif(netlistContent: string): string {
  throw new Error('Not implemented yet');
}