import { Parser } from "./parser";
import { Normalizer } from "./normalizer";
import { getTarget } from "./generator";
import "./targets/js";

const content = `
@SOURCE :=
  -
    @imports import_declaration[]

@import_declaration :=
  - "from"
    @module string_literal
    "import"
    @imports import_specifier[","]

@import_specifier :=
  -
    @name, store identifier
  -
    @name identifier
    "as"
    @store identifier
  -
    "*"
    "as"
    @all identifier

keyword :=
  "from"
  "import"
  "as"
  "let"
  "const"
  "imp"
  "fun"
  "self"
  "class"
  "extends"
  "static"
  "public"
  "private"
  "protected"
  "readonly"
  "constructor"
  "new"
  "return"
  "yield"
  "finish"
  "if"
  "for"
  "in"
  "has"
  "continue"
  "break"

$identifier :=
  !keyword identifier_word

identifier_word := /[a-zA-Z_][a-zA-Z0-9_]*/

$string_literal :=
  single_quote
  double_quote

single_quote := /'(?:[^'\\\\]|\\\\.)*'/
double_quote := /"(?:[^"\\\\]|\\\\.)*"/
`.trim();

const parser = new Parser();
const normalizer = new Normalizer();
const result = parser.parse(content);
const final = normalizer.normalize(result);
const target = getTarget("js")!;
const source = target.gen(final);

console.log(source);

debugger;
