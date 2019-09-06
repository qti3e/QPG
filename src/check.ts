import { Node } from "./parser";

export function check(nodes: Node[]): void {
  // TODO(qti3e) Type Check the nodes.
  // Rules:
  // 1. No catch in non-ast nodes.
  // 2. No catch in match-value nodes.
  // 3. Mixed LR binary nodes.
  // 4. No left recursion.
  // 5. No empty array separator.
  // 6. No white space at the beginning of terminals.
  // 7. Binary cannot have catch.
}

