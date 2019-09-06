import { Parser } from "./parser";
import { Normalizer } from "./normalizer";
import { getTarget } from "./generator";
import { check } from "./check";

import "./targets/js";
import "./targets/ts";

export function generate(source: string, target: "js" | "ts"): string {
  const parser = new Parser();
  const normalizer = new Normalizer();
  const result = parser.parse(source);
  const final = normalizer.normalize(result);
  check(final);
  return getTarget(target)!.gen(final);
}
