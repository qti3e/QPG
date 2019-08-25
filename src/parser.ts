import { Source } from "./source";
import {
  ParsedDeclaration,
  Rule,
  RuleNode,
  RuleNodeKind
} from "./parser_types";

const identifierRegExp = /^[a-zA-Z_][a-zA-Z0-9_]*/;
const maxIdLen = 100;
const regExpRegExp = /^\/(?:[^\/\\]|\\.)*\//;
const maxRegExpLen = 150;
const stringLiteralRegExp = /^"(?:[^"\\]|\\.)*"/;
const maxStringLiteralLen = 150;

/**
 * A parser that parses QPG documents.
 */
export class Parser {
  /**
   * Name of current top level declaration.
   */
  private currentDeclaration = "";

  /**
   * Parse a source into a list of its top level declarations.
   * @param source Source of the document you want to match.
   */
  parse(source: Source): ParsedDeclaration[] {
    const document: ParsedDeclaration[] = [];
    let declaration: ParsedDeclaration | undefined;

    while ((declaration = this.getDeclaration(source))) {
      document.push(declaration);
    }

    // if (!source.eof())
    // throw new Error("Parser did not reached the end of document.");

    return document;
  }

  private identifier(source: Source): string {
    return source.regexp(identifierRegExp, maxIdLen);
  }

  private getDeclaration(source: Source): ParsedDeclaration | undefined {
    const name = this.identifier(source);
    if (!name || !source.terminal(":=")) return;

    this.currentDeclaration = name;
    const declaration: ParsedDeclaration = { name, paths: [] };

    if (source.terminal("NOT")) {
      let not: string;
      if (source.newLine() || !(not = this.identifier(source)))
        throw new Error("Expected an identifier after a NOT tag.");
      declaration.not = not;
    } else if (source.terminal("R")) {
      let value: string;
      if (
        source.newLine() ||
        !(value = source.regexp(regExpRegExp, maxRegExpLen))
      )
        throw new Error("Expected a RegExp literal after a R tag.");
      value = value.slice(1, value.length - 1);
      if (value[0] !== "^") value = "^" + value;
      declaration.regexp = value;
    }

    if (!source.newLine()) throw new Error("Expected new line.");
    if (declaration.regexp) return declaration;

    let rule: Rule | undefined;
    while ((rule = this.getRule(source))) {
      declaration.paths.push(rule);
    }

    return declaration;
  }

  private getRule(source: Source): Rule | undefined {
    if (!source.indent()) return;
    const rule: Rule = [];
    let atomic: RuleNode | undefined;
    while ((atomic = this.getAtomic(source))) {
      rule.push(atomic);
      if (source.newLine()) break;
    }
    return rule;
  }

  private getAtomic(source: Source): RuleNode | undefined {
    let value: string | undefined;
    if (source.terminal("~~")) return { kind: RuleNodeKind.NoNewLine };
    if (source.terminal("~")) return { kind: RuleNodeKind.NoWhiteSpace };
    if ((value = this.identifier(source))) {
      return {
        kind: RuleNodeKind.Reference,
        name: value,
        array: source.terminal("[]")
      };
    }
    if ((value = source.regexp(stringLiteralRegExp, maxStringLiteralLen))) {
      return {
        kind: RuleNodeKind.Terminal,
        value
      };
    }
    const declaration = this.currentDeclaration;
    const loc = `in ${declaration} declaration, line: ${source.getLineNo()}`;
    throw new Error(`Unexpected character (${loc}).`);
  }
}
