import { Node, TerminalAtomic, ReferenceAtomic } from "./parser";

export function getTypes(nodes: Node[]): Map<string, TypeNode> {
  const result = new Map<string, TypeNode>();
  const map = new Map<string, Node>();

  for (const node of nodes) {
    map.set(node.name, node);
    result.set(node.name, new TypeNode(node.name));
  }

  for (const node of nodes) {
    if (!node.isASTNode) continue;
    const type = result.get(node.name)!;

    if (node.matchValue) {
      const terminals = new Set<string>();
      const seen = new Set<Node>();
      const toVisit: Node[] = [node];
      let isString = false;

      main: for (const node of toVisit) {
        if (seen.has(node)) continue;
        seen.add(node);

        for (const path of node.paths) {
          if (path.parts.length === 1) {
            const first = path.parts[0];

            if (first instanceof TerminalAtomic && first.catches.length === 0) {
              terminals.add(first.value);
              continue;
            }

            if (
              first instanceof ReferenceAtomic &&
              first.catches.length === 0 &&
              !first.array
            ) {
              const n = map.get(first.name)!;
              toVisit.push(n);
              if (n.isASTNode)
                throw new Error(
                  "Cannot link to an AST node from a value based node."
                );
              continue;
            }
          }

          isString = true;
          terminals.clear();
          break main;
        }
      }

      if (isString) {
        type.add("value", new StringType());
        continue;
      }

      for (const t of terminals) {
        type.add("value", new TerminalType(t, false));
      }

      continue;
    }

  }

  return result;
}

export class TypeNode {
  private readonly typeMap = new Map<string, Type[]>();

  constructor(readonly name: string) {}

  add(fieldName: string, type: Type) {
    if (!this.typeMap.has(fieldName) || type instanceof StringType)
      return this.typeMap.set(fieldName, [type]);

    const current = this.typeMap.get(fieldName)!;
    for (const c of current) if (type.is(c) || c instanceof StringType) return;
    current.push(type);
  }

  is(type: Type) {
    if (this === type) return true;
    return false;
  }
}

export type Type = TerminalType | ReferenceType | StringType | TypeNode;

export class TerminalType {
  constructor(readonly value: string, readonly isArray: boolean) {}

  is(type: Type) {
    if (type === this) return true;
    if (!(type instanceof TerminalType)) return false;
    return type.value === this.value && type.isArray === this.isArray;
  }
}

export class ReferenceType {
  constructor(readonly to: string, readonly isArray: boolean) {}

  is(type: Type) {
    if (type === this) return true;
    if (!(type instanceof ReferenceType)) return false;
    return type.to === this.to && type.isArray === this.isArray;
  }
}

export class StringType {
  constructor() {}

  is(type: Type) {
    if (type === this) return true;
    if (!(type instanceof StringType)) return false;
    return true;
  }
}
