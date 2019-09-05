import { Parser } from "./parser";
import { Normalizer } from "./normalizer";
import { getTarget } from "./generator";
import "./targets/js";

const content = `
@SOURCE := @statements STATEMENT[]

STATEMENT :=
  EXPRESSION_STATEMENT

@EXPRESSION_STATEMENT :=
  @expression EXPRESSION ";"

EXPRESSION :=
  ADD

@BINARY ADD :=
  MUL
  ADD "+" MUL
  ADD "-" MUL

@BINARY MUL :=
  NUM
  MUL "*" NUM
  MUL "/" NUM

$NUM := /\\d+/

`.trim();

const parser = new Parser();
const normalizer = new Normalizer();
const result = parser.parse(content);
const final = normalizer.normalize(result);
const target = getTarget("js")!;
const source = target.gen(final);

console.log(source);

debugger;
