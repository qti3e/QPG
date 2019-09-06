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

class JSTarget extends Target {
  protected indent = "  ";
  protected header = `// QPG :)
const parser = (function Parser() {
  let _source, _cursor;

  function getSkippedCursor() {
    let cursor = _cursor;
    while (cursor < _source.length && _source[cursor].trim() === "") cursor++;
    return cursor;
  }

  function terminal(text) {
    const cursor = getSkippedCursor();
    if (!_source.startsWith(text, cursor)) return false;
    _cursor = cursor + text.length;
    return text;
  }

  function regExp(r) {
    const cursor = getSkippedCursor();
    const source = _source.slice(cursor);
    const match = source.match(r);
    if (!match || match.index > 0) return false;
    _cursor = cursor + match[0].length;
    return match[0];
  }

  const lrBinary = o => () => {
    let right, prev, op;

    prev = o.head();

    if (!prev) return;

    while (true) {
      if (!(op = o.op())) break;

      right = o.rhs();

      if (!right) break;

      prev = {
        kind: o.name,
        op,
        lhs: prev,
        rhs: right
      };
    }

    return prev;
  };

  const readArraySep = (cb, sep) => {
    const ret = [];
    while (true) {
      const tmp = cb();
      if (!tmp) break;
      ret.push(tmp);
      if (!terminal(sep)) break;
    }
    return ret;
  };

  const readArray = cb => {
    const ret = [];
    while (true) {
      const tmp = cb();
      if (!tmp) break;
      ret.push(tmp);
    }
    return ret;
  };

  // # -----END---- #
`;

  protected footer = `  return {
    parse(source) {
      _source = source;
      _cursor = 0;
      return $SOURCE();
    }
  };
})();

const s = parser.parse("from 'x' import a");
console.log(JSON.stringify(s, null, 2));`;

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
      const $${node.name} = lrBinary({
        name: ${node.quotedName()},
        head: $${(node.paths[0].parts[0] as ReferenceAtomic).name},
        rhs: $${(node.paths[1].parts[2] as ReferenceAtomic).name},
        op: () => ${(node.paths[1].parts[1] as OneOfAtomic).alternates
          .map(
            atomic => `terminal(${(atomic as TerminalAtomic).quotedValue()})`
          )
          .join(" || ")},
      });
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
      const $${node.name} = () => regExp(${
        (node.get(0, 0) as RegExpAtomic).source
      });
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
      const $${node.name} = () => {
        const value = regExp(${(node.get(0, 0) as RegExpAtomic).source});
        if (!value) return;
        return {
          kind: ${node.quotedName()},
          value
        };
      };
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
        const $${node.name} = () => {
          const ret = [];
          while (true) {
            const tmp = $${(node.get(0, 0) as ReferenceAtomic).name}();
            if (!tmp) break;
            ret.push(tmp);
          }
          return {
            kind: ${node.quotedName()},
            ${(node.get(0, 0) as ReferenceAtomic).catches
              .map(name => `"${name}": ret`)
              .join(",\n")}
          };
        };
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
      const $${node.name} = () => ${node.paths
        .map(path => `$${(path.parts[0] as ReferenceAtomic).name}()`)
        .join(" ||\n")};`
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
      const $${node.name} = () => {
        const c = _cursor;
        const node = {kind: ${node.quotedName()}};

        if (${node.paths[0].parts.map(atomic2JS).join(" && ")})
          return node;

        _cursor = c;
      }
      `
    );

    this.addPattern(
      node => node.isASTNode && !node.matchValue,
      node => outdent`
      const $${node.name} = () => {
        const c = _cursor;
        let node;
        ${node.paths
          .map(
            path => `
        _cursor = c;
        node = {kind: ${node.quotedName()}};
        if (${path.parts.map(atomic2JS).join(" && ")})
          return node;
        `
          )
          .join("")}
        _cursor = c;
      };`
    );

    this.addPattern(
      node => node.isASTNode && node.matchValue,
      node => outdent`
      const $${node.name} = () => {
        const c = _cursor;
        let value, tmp;
        ${node.paths
          .map(
            path => `
        _cursor = c;
        value = "";
        if (${path.parts
          .map(atomic2JS)
          .map(v => (v[0] !== "!" ? `((tmp = ${v}), (value += tmp), tmp)` : v))
          .join(" && ")})
          return {kind: ${node.quotedName()}, value};
        `
          )
          .join("")}
        _cursor = c;
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
      const $${node.name} = () => ${node.paths
        .map(
          path => `terminal(${(path.parts[0] as TerminalAtomic).quotedValue()})`
        )
        .join(" || ")};
      `
    );

    this.addPattern(
      node => !node.isASTNode,
      node => outdent`
      const $${node.name} = () => {
        const c = _cursor;
        let value, tmp;
        ${node.paths
          .map(
            path => `
        _cursor = c;
        value = "";
        if (${path.parts
          .map(atomic2JS)
          .map(v => (v[0] !== "!" ? `((tmp = ${v}), (value += tmp), tmp)` : v))
          .join(" && ")})
          return value;
        `
          )
          .join("")}
        _cursor = c;
      };`
    );
  }
}

function atomic2JS(atomic: Atomic): string {
  if (
    atomic instanceof TerminalAtomic ||
    atomic instanceof ReferenceAtomic ||
    atomic instanceof RegExpAtomic
  ) {
    let value: string;
    if (atomic instanceof TerminalAtomic) {
      value = `terminal(${atomic.quotedValue()})`;
    } else if (atomic instanceof RegExpAtomic) {
      value = `regExp(${atomic.source})`;
    } else {
      value = `$${atomic.name}()`;
      if (atomic.array) {
        if (atomic.array.separator) {
          value = `readArraySep($${
            atomic.name
          }, ${atomic.array.separator.quotedValue()})`;
        } else {
          value = `readArray($${atomic.name})`;
        }
      }
    }

    return (
      "(" +
      [...atomic.catches.map(name => `node["${name}"]`), value].join(" = ") +
      ")"
    );
  }

  if (atomic instanceof NotAtomic) {
    return `!(${atomic2JS(atomic.part)})`;
  }

  return atomic.alternates.map(a => atomic2JS(a)).join(" || ");
}

registerLanguage("js", new JSTarget());
