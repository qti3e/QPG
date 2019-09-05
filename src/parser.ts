const identifierRegExp = /^[a-zA-Z_][a-zA-Z0-9_\-]*/;
const doubleQuoteRegExp = /^"(?:[^"\\]|\\.)*"/;
const regExpRegExp = /^\/(?:[^\/\\]|\\.)*\//;

export class Parser {
  private lines: string[] = [];
  private currentLineNo = 0;
  private insertedLines = 0;
  private indentation: string | undefined;

  private getIndent(line?: string): string {
    if (this.indentation) return this.indentation;
    if (!line || !line.trim()) throw new Error("Cannot find indentation.");
    let indent = "";
    let cursor = 0;
    while (cursor < line.length && line[cursor].trim() === "") {
      indent += line[cursor];
      ++cursor;
    }
    if (indent !== "\t") {
      const onlySpace = [...indent].filter(x => x === " ");
      const lengthLog = Math.log2(onlySpace.length);
      const validSpace =
        onlySpace.length === indent.length && (lengthLog | 0) === lengthLog;
      if (!validSpace) throw new Error("Invalid indentation.");
    }
    this.indentation = indent;
    return indent;
  }

  parse(source: string): Node[] {
    const nodes: Node[] = [];
    this.lines = source.split(/\r?\n/g);
    this.currentLineNo = 0;
    this.indentation = undefined;
    this.insertedLines = 0;

    while (this.currentLineNo < this.lines.length) {
      // If there is an empty line skip it.
      if (this.lines[this.currentLineNo].trim() === "") continue;
      nodes.push(this.parseTopLevelLine());
    }

    return nodes;
  }

  parseTopLevelLine(): Node {
    let line = this.lines[this.currentLineNo++];
    let cursor = 0;
    // Data
    const paths: Path[] = [];
    let isASTNode = false;
    let matchValue = false;
    let binary = false;
    let name: string;

    if (line[cursor] === "@") {
      ++cursor;
      isASTNode = true;
    } else if (line[cursor] === "$") {
      ++cursor;
      isASTNode = matchValue = true;
    }

    if (line.startsWith("BINARY", cursor)) {
      binary = true;
      cursor = skip(line, cursor + 6);
    }

    let nameResult = readIdentifier(line, cursor);
    if (!nameResult) throw new Error(`Expected an identifier.`);
    name = nameResult;
    cursor = skip(line, cursor + name.length);

    if (!line.startsWith(":=", cursor)) throw new Error(`Expected :=`);
    cursor = skip(line, cursor + 2);
    line = line.slice(cursor);

    if (line.trim()) {
      // OK, This not part of the language grammar but humans expect it to work.
      // This hack will do the job.
      if (!this.indentation) {
        let i = -1;
        while (this.currentLineNo + i + 1 < this.lines.length) {
          ++i;
          if (this.lines[this.currentLineNo + i].trim() === "") continue;
          if (this.lines[this.currentLineNo + i][0].trim() === "") {
            this.getIndent(this.lines[this.currentLineNo + i]);
            break;
          }
        }
      }
      line = this.indentation + line;
      this.lines.splice(this.currentLineNo, 0, line);
      ++this.insertedLines;
    }

    while (this.currentLineNo < this.lines.length) {
      // If there is an empty line skip it.
      if (this.lines[this.currentLineNo].trim() === "") {
        this.currentLineNo++;
        continue;
      }
      // If there is no indent break the loop.
      if (this.lines[this.currentLineNo][0].trim() !== "") break;
      paths.push(this.parsePathLine());
    }

    return new Node(name, isASTNode, matchValue, binary, paths);
  }

  private parsePathLine(): Path {
    let line = this.lines[this.currentLineNo++];
    const parts: Atomic[] = [];
    const indent = this.getIndent(line);
    if (!line.startsWith(indent)) throw new Error("Expected an indentation.");
    // Remove the indentation.
    line = line.slice(indent.length).trim();

    if (line[0] !== "-") return new Path(this.parsePathParts(line));

    // Multiline Path
    line = line.slice(1);
    if (line) parts.push(...this.parsePathParts(line.trim()));

    while (this.currentLineNo < this.lines.length) {
      const currentLine = this.lines[this.currentLineNo];
      // If there is an empty line skip it.
      if (currentLine.trim() === "") {
        this.currentLineNo++;
        continue;
      }
      if (!currentLine.startsWith(indent + indent)) break;
      this.currentLineNo++;
      parts.push(...this.parsePathParts(currentLine.slice(indent.length * 2)));
    }

    return new Path(parts);
  }

  private parsePathParts(line: string): Atomic[] {
    const result: Atomic[] = [];
    while (line) {
      const [length, atomic] = this.parseAtomic(line);
      line = line.slice(length).trim();
      result.push(atomic);
    }
    return result;
  }

  private parseAtomic(text: string): [number, Atomic] {
    if (text[0] === '"') return this.parseTerminalAtomic(text);
    if (text[0] === "@") return this.parseCatchAtomic(text);
    if (text[0] === "/") return this.parseRegExpAtomic(text);
    if (text[0] === "!") return this.parseNotAtomic(text);
    if (text[0] === "[") return this.parseOneOfAtomic(text);
    return this.parseReferenceAtomic(text);
  }

  parseOneOfAtomic(text: string): [number, OneOfAtomic] {
    throw new Error("Not Implemented.");
  }

  parseNotAtomic(text: string): [number, NotAtomic] {
    if (text[0] !== "!")
      throw new Error("Expected a '!' at the beginning of a not atomic.");
    const cursor = skip(text, 1);
    const [len, part] = this.parseAtomic(text.slice(cursor));
    return [cursor + len, new NotAtomic(part)];
  }

  parseRegExpAtomic(text: string): [number, RegExpAtomic] {
    const match = text.match(regExpRegExp);
    if (!match) throw new Error("Expected regexp literal.");
    const value = match[0];
    const atomic = new RegExpAtomic(value);
    return [value.length, atomic];
  }

  parseTerminalAtomic(text: string): [number, TerminalAtomic] {
    const match = text.match(doubleQuoteRegExp);
    if (!match) throw new Error("Expected double quote terminal.");
    const value = match[0];
    const atomic = new TerminalAtomic(JSON.parse(value));
    return [value.length, atomic];
  }

  parseCatchAtomic(text: string): [number, TerminalAtomic | ReferenceAtomic] {
    const names: string[] = [];
    if (text[0] !== "@") throw new Error("Expected a catch segment.");
    let cursor = skip(text, 1);

    while (true) {
      const name = readIdentifier(text, cursor);
      if (!name) throw new Error("Expected an identifier.");
      names.push(name);
      cursor = skip(text, cursor + name.length);
      if (text[cursor] !== ",") break;
      cursor = skip(text, cursor + 1);
    }

    cursor = skip(text, cursor);
    text = text.slice(cursor);

    if (text[0] === '"') {
      const [len, atomic] = this.parseTerminalAtomic(text);
      atomic.catches.push(...names);
      return [len + cursor, atomic];
    }

    const [len, atomic] = this.parseReferenceAtomic(text);
    atomic.catches.push(...names);
    return [len + cursor, atomic];
  }

  parseReferenceAtomic(text: string): [number, ReferenceAtomic] {
    const name = readIdentifier(text, 0);
    if (!name) throw new Error("Expected an identifier.");
    if (text[name.length] === "[") {
      text = text.slice(name.length);
      const [length, specifier] = this.parseArraySpecifier(text);
      return [name.length + length, new ReferenceAtomic(name, [], specifier)];
    }
    return [name.length, new ReferenceAtomic(name)];
  }

  parseArraySpecifier(text: string): [number, ArraySpecifier] {
    if (text[0] !== "[") throw new Error("Expected an array specifier.");
    let cursor = skip(text, 1);
    if (text[cursor] === "]") {
      return [cursor + 1, new ArraySpecifier(undefined)];
    }

    const [len, sep] = this.parseTerminalAtomic(text.slice(cursor));
    cursor = skip(text, cursor + len);

    if (text[cursor] !== "]")
      throw new Error("Expected ] at the end of an array specifier.");

    return [cursor + 1, new ArraySpecifier(sep)];
  }
}

function readIdentifier(line: string, cursor: number): string | null {
  const tmp = line.slice(cursor).match(identifierRegExp);
  if (!tmp) return null;
  return tmp[0];
}

function skip(line: string, cursor: number): number {
  while (cursor < line.length && line[cursor].trim() === "") ++cursor;
  return cursor;
}

export class Node {
  private hasCatchCache?: boolean;

  constructor(
    readonly name: string,
    readonly isASTNode: boolean,
    readonly matchValue: boolean,
    readonly binary: boolean,
    readonly paths: Path[],
    readonly isLR = false
  ) {}

  quotedName() {
    return JSON.stringify(this.name);
  }

  get(i: number, j: number): Atomic | undefined {
    if (!this.has(i, j)) return undefined;
    return this.paths[i].parts[j];
  }

  has(i: number, j: number): boolean {
    return this.paths.length > i && this.paths[i].parts.length > j;
  }

  hasCatch(): boolean {
    if (this.hasCatchCache !== undefined) return this.hasCatchCache;

    let ret = false;
    const toVisit: Atomic[] = [];

    for (const path of this.paths)
      for (const atomic of path.parts) toVisit.push(atomic);

    for (const atomic of toVisit) {
      if (atomic instanceof RegExpAtomic || atomic instanceof ReferenceAtomic) {
        if (atomic.catches.length) {
          ret = true;
          break;
        }
      }

      if (atomic instanceof NotAtomic) {
        toVisit.push(atomic.part);
        continue;
      }

      if (atomic instanceof OneOfAtomic) {
        toVisit.push(...atomic.alternates);
        continue;
      }
    }

    this.hasCatchCache = ret;
    return ret;
  }
}

export class Path {
  constructor(readonly parts: Atomic[]) {}
}

export type Atomic =
  | TerminalAtomic
  | ReferenceAtomic
  | RegExpAtomic
  | NotAtomic
  | OneOfAtomic;

export class TerminalAtomic {
  constructor(readonly value: string, readonly catches: string[] = []) {}

  quotedValue() {
    return JSON.stringify(this.value);
  }
}

export class ReferenceAtomic {
  constructor(
    readonly name: string,
    readonly catches: string[] = [],
    readonly array?: ArraySpecifier | undefined
  ) {}
}

export class ArraySpecifier {
  constructor(readonly separator: TerminalAtomic | undefined) {}
}

export class RegExpAtomic {
  constructor(readonly source: string, readonly catches: string[] = []) {}
}

export class NotAtomic {
  constructor(readonly part: Atomic) {}
}

export class OneOfAtomic {
  constructor(readonly alternates: Atomic[]) {}
}
