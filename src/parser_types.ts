/**
 * A top level declaration.
 */
export interface ParsedDeclaration {
  /**
   * Name of the declaration node.
   */
  name: string;

  /**
   * If it was a RegExp token, here we'll have the regexp source.
   */
  regexp?: string;

  /**
   * The value of the NOT tag.
   */
  not?: string;

  /**
   * List of alternate paths in a declaration.
   */
  paths: Rule[];
}

/**
 * A rule is a line of QPG document that indicates a rule to match a particular
 * thing.
 */
export type Rule = RuleNode[];

/**
 * A rule node is just like a token - it represents an atomic part of a rule
 */
export type RuleNode =
  | TerminalMatcher
  | NoNewLineMatcher
  | NoWhiteSpaceMatcher
  | ReferenceNode;

export enum RuleNodeKind {
  Terminal,
  NoNewLine,
  NoWhiteSpace,
  Reference
}

/**
 * Matches against a fixes string.
 */
export interface TerminalMatcher {
  kind: RuleNodeKind.Terminal;
  value: string;
}

/**
 * Applies "no new line here" rule.
 * (By default we skip any white space or new line character)
 */
export interface NoNewLineMatcher {
  kind: RuleNodeKind.NoNewLine;
}

/**
 * Applies "no white space here" rule.
 * (By default we skip any white space or new line character)
 */
export interface NoWhiteSpaceMatcher {
  kind: RuleNodeKind.NoWhiteSpace;
}

/**
 * Reference to another rule.
 */
export interface ReferenceNode {
  kind: RuleNodeKind.Reference;
  name: string;
  array?: boolean;
}
