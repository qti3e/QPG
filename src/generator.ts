import { Node } from "./parser";

interface TargetBase {
  gen(nodes: Node[]): string;
}

export abstract class Target implements TargetBase {
  protected indent = "";
  protected header?: string;
  protected footer?: string;

  private patterns = new Map<(node: Node) => boolean, (node: Node) => string>();

  addPattern(test: (node: Node) => boolean, gen: (node: Node) => string): void {
    this.patterns.set(test, gen);
  }

  gen(nodes: Node[]): string {
    let ret: string = this.header || "";

    for (const node of nodes) {
      let found = false;
      for (const [test, gen] of this.patterns) {
        if (test(node)) {
          found = true;
          const code = gen(node);
          if (!this.indent) {
            ret += code;
          } else {
            ret += code
              .split(/\r?\n/g)
              .map(l => this.indent + l)
              .join("\n");
          }
          ret += "\n\n";
          break;
        }
      }

      // Just for now...
      try {
        if (!found) throw new Error(`Cannot generate code for ${node.name}.`);
      } catch (e) {
        console.error(e);
      }
    }

    ret += this.footer || "";
    return ret;
  }
}

const languages: Map<string, TargetBase> = new Map();

export function registerLanguage(
  name: string,
  implementation: TargetBase
): void {
  if (languages.has(name)) throw new Error(`${name} is already registered.`);
  languages.set(name, implementation);
}

export function getTarget(name: string): TargetBase | undefined {
  return languages.get(name);
}
