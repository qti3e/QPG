/**
 * Our source document.
 */
export class Source {
  /**
   * Current cursor in the document.
   */
  private cursor = 0;

  /**
   * Length of the source code.
   */
  private readonly length: number;

  /**
   * The indentation used in this document.
   */
  private indentation: string | undefined;

  /**
   * Construct a new Source object.
   *
   * @param source QPG document source code
   */
  constructor(private readonly source: string) {
    this.length = source.length;
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

  /**
   * Matches against a terminal string returns a boolean indicating whatever it
   * found a match at the beginning of the document or not.
   *
   * This function skips white spaces after the current cursor.
   *
   * If a match was found it advances the current cursor.
   *
   * @param text The terminal string that we want to match.
   */
  terminal(text: string): boolean {
    const cursor = this.getSkippedCursor();
    if (!this.source.startsWith(text, cursor)) return false;
    this.cursor = cursor + text.length;
    return true;
  }

  /**
   * Like terminal() but matches against a RegExp.
   *
   * @param r The regex we want to match.
   * @param maxLen Max length of the string we wish to match for optimization.
   */
  regexp(r: RegExp, maxLen: number = Infinity): string {
    const cursor = this.getSkippedCursor();
    const source = this.source.slice(cursor, cursor + maxLen);
    const match = source.match(r);
    if (!match) return "";
    this.cursor = cursor + match[0].length;
    return match[0];
  }

  /**
   * Returns a boolean indicating if it was able to match a new line.
   * Moves the cursor to the next character after the CRLF character (if any).
   */
  newLine(): boolean {
    let cursor = this.cursor;
    let ch = this.source[cursor];

    while (cursor < this.length && !ch.trim()) {
      if (ch === "\r" && this.source[this.cursor + 1] === "\n") {
        this.cursor = cursor + 2;
        return true;
      }

      if (ch === "\n") {
        this.cursor = cursor + 1;
        return true;
      }

      ch = this.source[++cursor];
    }

    return false;
  }

  /**
   * Find the indentation used in the document in place of where indent() was called.
   * @throws If there was no indent or it was invalid (like a "  \t").
   */
  private findIndent(): void {
    let indentation = "";
    let cursor = this.cursor;
    let ch = this.source[cursor];
    while (cursor < this.length && !ch.trim()) {
      indentation += ch;
      ch = this.source[++cursor];
    }

    if (
      indentation !== "\t" &&
      indentation !== "  " &&
      indentation !== "    " &&
      indentation !== "        "
    ) {
      throw new Error("Invalid indentation in QPG document.");
    }

    this.indentation = indentation;
  }

  /**
   * Matches against the indentation character of this document.
   */
  indent(): boolean {
    if (!this.indentation) this.findIndent();

    if (this.source.startsWith(this.indentation!, this.cursor)) {
      this.cursor += this.indentation!.length;
      return true;
    }

    return false;
  }

  /**
   * Check if we reached end of the document.
   */
  eof(): boolean {
    return this.getSkippedCursor() >= this.length - 1;
  }

  getLineNo(): number {
    let lineNo = 1;
    let cursor = 0;
    while (cursor < this.cursor) {
      if (this.source[cursor++] === "\n") ++lineNo;
    }
    return lineNo;
  }
}
