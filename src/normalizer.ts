import {
  Node,
  Path,
  OneOfAtomic,
  ReferenceAtomic,
  TerminalAtomic,
  Atomic,
  NotAtomic
} from "./parser";

export class Normalizer {
  private map: Map<string, Node> = new Map();

  normalize(nodes: Node[]): Node[] {
    this.map.clear();
    for (const node of nodes) {
      this.map.set(node.name, node);
    }

    const newNodes = nodes.map(x => this.normalizeNode(x));

    this.map.clear();
    for (const node of newNodes) {
      this.map.set(node.name, node);
    }

    return this.sortAndDCE();
  }

  sortAndDCE(): Node[] {
    const result: Node[] = [];
    const toVisit: Node[] = [];
    const seen = new Set<Node>();

    const source = this.map.get("SOURCE");
    if (!source) throw new Error("Every document must have a SOURCE.");
    toVisit.push(source);

    const visitAtomic = (atomic: Atomic): void => {
      if (atomic instanceof ReferenceAtomic) {
        const tmp = this.map.get(atomic.name);
        if (!tmp) throw new Error(`Name cannot be resolved "${atomic.name}".`);
        if (seen.has(tmp)) return;
        toVisit.push(tmp);
        return;
      }

      if (atomic instanceof OneOfAtomic) {
        return void atomic.alternates.map(atomic => visitAtomic(atomic));
      }

      if (atomic instanceof NotAtomic) {
        return visitAtomic(atomic.part);
      }
    };

    while (toVisit.length) {
      const current = toVisit.pop()!;
      if (seen.has(current)) continue;
      seen.add(current);

      for (const path of current.paths) {
        for (const part of path.parts) {
          visitAtomic(part);
        }
      }

      result.push(current);
    }

    return result.reverse();
  }

  normalizeNode(node: Node): Node {
    if (node.binary) return this.normalizeBinary(node);
    return node;
  }

  normalizeBinary(node: Node): Node {
    const heads: Path[] = [];
    const newPaths: Path[] = [];
    const paths: { lhs: string; rhs: string; ops: string[] }[] = [];
    let isLR = false;

    main: for (const path of node.paths) {
      if (path.parts.length === 1) {
        heads.push(path);
        continue;
      }

      if (path.parts.length !== 3)
        throw new Error("Binary node is not in the right format.");

      const lhs = path.parts[0];
      const op = path.parts[1];
      const rhs = path.parts[2];

      if (!(lhs instanceof ReferenceAtomic))
        throw new Error("LHS in a binary can only be a reference.");

      if (!(rhs instanceof ReferenceAtomic))
        throw new Error("RHS in a binary can only be a reference.");

      if (lhs.array || rhs.array) throw new Error("LHS/RHS cannot be arrays.");

      if (lhs.catches.length || rhs.catches.length)
        throw new Error("LHS/RHS cannot have catch clauses.");

      const ops = this.resolveOnlyTerminals(op).map(x => x.value);

      for (const path of paths) {
        if (path.lhs === lhs.name && rhs.name === path.rhs) {
          path.ops.push(...ops);
          continue main;
        }
      }

      paths.push({
        lhs: lhs.name,
        rhs: rhs.name,
        ops
      });
    }

    const head =
      heads.length === 0
        ? []
        : heads.length === 1
        ? [heads[0]]
        : [new Path([new OneOfAtomic(heads.map(x => x.parts[0]))])];

    for (const path of paths) {
      const lhs = new ReferenceAtomic(path.lhs);
      const rhs = new ReferenceAtomic(path.rhs);
      const ops = [...new Set(path.ops)].map(x => new TerminalAtomic(x));
      if (lhs.name === node.name) isLR = true;
      newPaths.push(new Path([lhs, new OneOfAtomic(ops), rhs]));
    }

    return new Node(
      node.name,
      node.isASTNode,
      node.matchValue,
      true,
      [...head, ...newPaths],
      isLR
    );
  }

  resolveOnlyTerminals(atomic: Atomic): TerminalAtomic[] {
    if (atomic instanceof TerminalAtomic) return [atomic];
    if (!(atomic instanceof ReferenceAtomic))
      throw new Error("Terminal was expected.");

    if (atomic.array) throw new Error("Terminal reference cannot be an array.");

    const terminals: TerminalAtomic[] = [];
    const node = this.map.get(atomic.name);
    if (!node) throw new Error("Unresolved reference.");

    for (const path of node.paths) {
      if (path.parts.length !== 1) throw new Error("Terminal was expected.");
      const tmp = path.parts[0];
      if (tmp instanceof TerminalAtomic) {
        terminals.push(tmp);
        continue;
      }
      terminals.push(...this.resolveOnlyTerminals(tmp));
    }

    return terminals;
  }
}
