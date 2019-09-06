import { Target, registerLanguage } from "../generator";
import { outdent } from "../util";
import {
  OneOfAtomic,
  ReferenceAtomic,
  TerminalAtomic,
  RegExpAtomic,
  Atomic,
  NotAtomic
} from "../parser";

class TSTarget extends Target {
  protected indent = "  ";
  protected header = `// QPG :)
export declare const parser: {
  parse(): QPG.SOURCE;
}

export declare namespace QPG {
`;

  protected footer = `}`;

  constructor() {
    super();

    this.addPattern(
      node =>
        node.isASTNode &&
        !node.matchValue &&
        node.binary &&
        node.isLR &&
        !node.hasCatch() &&
        node.paths.length == 2 &&
        node.paths[0].parts.length === 1 &&
        node.get(1, 1) instanceof OneOfAtomic &&
        node.paths[1].parts.length === 3,
      node => outdent`
      export interface ${node.name} {
        kind: ${node.quotedName()};
        lhs: ${(node.paths[0].parts[0] as ReferenceAtomic).name};
        rhs: ${(node.paths[1].parts[2] as ReferenceAtomic).name};
        op: ${(node.paths[1].parts[1] as OneOfAtomic).alternates
          .map(atomic => `${(atomic as TerminalAtomic).quotedValue()}`)
          .join(" | ")};
      }
      `
    );

    this.addPattern(
      node =>
        !node.isASTNode &&
        !node.binary &&
        !node.matchValue &&
        node.paths.length === 1 &&
        !node.has(0, 1) &&
        node.get(0, 0) instanceof RegExpAtomic &&
        !node.hasCatch(),
      node => outdent`
      export type ${node.name} = string;
      `
    );

    this.addPattern(
      node =>
        node.isASTNode &&
        !node.binary &&
        node.matchValue &&
        node.paths.length === 1 &&
        !node.has(0, 1) &&
        node.get(0, 0) instanceof RegExpAtomic &&
        !node.hasCatch(),
      node => outdent`
      export interface ${node.name} {
        kind: ${node.quotedName()};
        value: string;
      }
      `
    );

    this.addPattern(
      node =>
        node.isASTNode &&
        !node.binary &&
        node.paths.length === 1 &&
        !node.has(0, 1) &&
        node.hasCatch() &&
        node.get(0, 0) instanceof ReferenceAtomic &&
        (node.get(0, 0) as ReferenceAtomic).array !== undefined &&
        (node.get(0, 0) as ReferenceAtomic).array!.separator === undefined,
      node => outdent`
      export interface ${node.name} {
        kind: ${node.quotedName()};
        ${(node.get(0, 0) as ReferenceAtomic).catches
          .map(
            name => `"${name}": ${(node.get(0, 0) as ReferenceAtomic).name}[]`
          )
          .join(";\n")}
      }
      `
    );

    this.addPattern(
      node =>
        !node.isASTNode &&
        !node.hasCatch() &&
        node.paths.every(
          path =>
            path.parts.length === 1 &&
            path.parts[0] instanceof ReferenceAtomic &&
            (path.parts[0] as ReferenceAtomic).array === undefined
        ),
      node => outdent`
      export type ${node.name} = ${node.paths
        .map(path => `${(path.parts[0] as ReferenceAtomic).name}`)
        .join(" | ")};`
    );

    this.addPattern(
      node =>
        node.isASTNode &&
        !node.matchValue &&
        !node.binary &&
        node.paths.length === 1 &&
        node.paths[0].parts.every(
          atomic =>
            atomic instanceof ReferenceAtomic ||
            atomic instanceof TerminalAtomic
        ),
      node => outdent`
      export interface ${node.name} {
        kind: ${node.quotedName()};
        ${node.paths[0].parts.map(atomic2TS).join(" ")}
      }
      `
    );

    this.addPattern(
      node => node.isASTNode && !node.matchValue,
      node => outdent`
      export type ${node.name} = ${node.paths
        .map(
          path => `{
        kind: ${node.quotedName()};
        ${path.parts.map(atomic2TS).join("")}
      }`
        )
        .join(" | ")};
        `
    );

    this.addPattern(
      node => node.isASTNode && node.matchValue,
      node => outdent`
      export type ${node.name} = {
        kind: ${node.quotedName()};
        value: string;
      };`
    );

    this.addPattern(
      node =>
        !node.isASTNode &&
        !node.hasCatch() &&
        node.paths.every(
          path =>
            path.parts.length === 1 && path.parts[0] instanceof TerminalAtomic
        ),
      node => outdent`
      export type ${node.name} = ${node.paths
        .map(p => p.parts[0] as TerminalAtomic)
        .sort((a, b) => b.value.length - a.value.length)
        .map(atomic => `${atomic.quotedValue()}`)
        .join(" | ")};
      `
    );

    this.addPattern(
      node => !node.isASTNode,
      node => `export type ${node.name} = string;`
    );
  }
}

function atomic2TS(atomic: Atomic): string {
  if (
    atomic instanceof TerminalAtomic ||
    atomic instanceof ReferenceAtomic ||
    atomic instanceof RegExpAtomic
  ) {
    let value: string;
    if (atomic instanceof TerminalAtomic) {
      value = `${atomic.quotedValue()}`;
    } else if (atomic instanceof RegExpAtomic) {
      value = `string`;
    } else {
      value = atomic.array ? `${atomic.name}[]` : atomic.name;
    }

    return atomic.catches.map(name => `${name}: ${value};`).join(" ");
  }

  if (atomic instanceof NotAtomic) {
    return ``;
  }

  return atomic.alternates
    .map(a => atomic2TS(a))
    .filter(x => !!x)
    .join(" | ");
}

registerLanguage("ts", new TSTarget());
