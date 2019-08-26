type Unit = {
  name: string;
  parts: any[];
  value: string;
};

const names: string[] = ["SOURCE", "A", "A"];

class QParser {
  protected state: number = 0;
  protected path: number[] = [];
  private readonly length: number;
  private cursor = 0;
  private stack: Unit[] = [{ name: "", parts: [], value: "" }];

  constructor(private readonly source: string) {
    this.length = source.length;
  }

  protected goto(state: number): boolean {
    const cursor = this.cursor;
    const node = { name: names[state], parts: [], value: "" };
    this.path.push(state);
    this.stack.push(node);
    const ret = (this as any)[state]();
    this.path.pop();
    this.stack.pop();
    if (ret) {
      this.push(node);
      node.value = this.source.slice(cursor, this.cursor);
    } else {
      this.cursor = cursor;
    }
    return ret;
  }

  protected phi(...elements: number[]): boolean {
    const last = this.path[this.path.length - 2];

    for (let i = 0; i < elements.length; i += 2) {
      if (last === elements[i]) {
        return this.goto(elements[i + 1]);
      }
    }

    throw new Error(`Phi state change cannot determine the next state.`);
  }

  /**
   * Will return the index of the first non-blank character after the current
   * cursor.
   */
  private getSkippedCursor(): number {
    let cursor = this.cursor;
    while (cursor < this.length && !this.source[cursor].trim()) ++cursor;
    return cursor;
  }

  protected terminal(text: string): boolean {
    const cursor = this.getSkippedCursor();
    if (!this.source.startsWith(text, cursor)) return false;
    this.cursor = cursor + text.length;
    return true;
  }

  /**
   * Check if we reached end of the document.
   */
  eof(): boolean {
    return this.getSkippedCursor() >= this.length;
  }

  push(x: any): true {
    const s = this.stack[this.stack.length - 1];
    if (!s) throw new Error("X");
    s.parts.push(x);
    return true;
  }
}

class Parser extends QParser {
  constructor(source: string) {
    super(source);
    this.goto(0);
  }

  [0]() {
    return this.goto(1) && this.goto(1);
  }

  [-1]() {
    console.log("End", this.eof());
  }

  [1]() {
    const matched = this.terminal("X") && this.push("X");
    if (!matched) return this.goto(-1);
    this.goto(2);
    return true;
  }

  [2]() {
    const matched = this.terminal("T") && this.push("T");
    if (!matched) return;
    this.goto(2);
    return true;
  }

  [100]() {
    console.log("ERROR");
  }
}

const p = new Parser(`XTT XT`);
console.log((p as any).stack[0].parts);
debugger;
