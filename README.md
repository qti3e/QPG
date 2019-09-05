<!--
 Copyright (c) 2019 qti3e

 This software is released under the MIT License.
 https://opensource.org/licenses/MIT
-->

# [WIP] QPG

Zero configuration parser generator that just works.

QPG is not designed to be fast, but to provide a really nice experience for
those of us who just want to create a parser for their new awesome programming
language and get things done.

Right now only JavaScript is supported, but it's easy to add a new backend.

Unlike many parser generators QPG produces an understandable AST without any
bullshit and it's designed to work best for programming languages!

## Example

```qpg
@SOURCE := @statements STATEMENT[]

STATEMENT :=
  EXPRESSION_STATEMENT

@EXPRESSION_STATEMENT :=
  -
    @expression EXPRESSION
    ";"

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
```

top level `@` means the node is actually an AST node, and then you can use
`@` to catch things in the Node object.

`$` means this is a text-only AST Node (like Numeric literal, string literal
and so on) and we want to catch the part of the source code that matched
against the pattern.

`BINARY` is designed to work with binary operations and especially those that
are left-recursive.

`-` starts a new multiline path.

And then you can easily use your generated parser like following:

```js
const s = parser.parse("3 + 4 * 5; 2 - 5;");
console.log(JSON.stringify(s, null, 2));`;
```

and this is the clean output I promised:

```json
{
  "kind": "SOURCE",
  "statements": [
    {
      "kind": "EXPRESSION_STATEMENT",
      "expression": {
        "kind": "ADD",
        "op": "+",
        "lhs": {
          "kind": "NUM",
          "value": "3"
        },
        "rhs": {
          "kind": "MUL",
          "op": "*",
          "lhs": {
            "kind": "NUM",
            "value": "4"
          },
          "rhs": {
            "kind": "NUM",
            "value": "5"
          }
        }
      }
    },
    {
      "kind": "EXPRESSION_STATEMENT",
      "expression": {
        "kind": "ADD",
        "op": "-",
        "lhs": {
          "kind": "NUM",
          "value": "2"
        },
        "rhs": {
          "kind": "NUM",
          "value": "5"
        }
      }
    }
  ]
}
```

## Unresolved issues

I'm still thinking about how to handle comments in the codes - any idea is welcomed.
