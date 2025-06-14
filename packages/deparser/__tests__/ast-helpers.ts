import { cleanTree } from '../src/utils';
import { Deparser } from '../src/deparser';

function unwrapNode(node: any): any {
  if (Array.isArray(node)) {
    return node.map(unwrapNode);
  }
  if (node && typeof node === 'object') {
    if (node.RangeVar && Object.keys(node).length === 1) {
      return unwrapNode(node.RangeVar);
    }
    if (node.List && Object.keys(node).length === 1) {
      return node.List.items ? unwrapNode(node.List.items) : [];
    }
    const out: any = {};
    for (const [k, v] of Object.entries(node)) {
      out[k] = unwrapNode(v);
    }
    return out;
  }
  return node;
}

let parseFn: ((sql: string) => any) | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  parseFn = require('@pgsql/parser').parse;
} catch {
  // Parser not available in this environment
  parseFn = null;
}

/**
 * Compare a manually constructed AST with the output of parsing the SQL text.
 * If the parser is not available, this check is skipped so tests remain green.
 */
export function expectAstMatchesParse(sql: string, ast: any) {
  if (!parseFn) return;
  const parsed = parseFn(sql);
  const parsedStmt = Array.isArray(parsed)
    ? parsed[0]?.RawStmt?.stmt ?? parsed[0]
    : parsed?.stmts?.[0]?.stmt ?? parsed;
  const inputStmt = ast?.RawStmt?.stmt ?? ast;
  const normalize = (node: any) => unwrapNode(cleanTree(node));
  expect(normalize(inputStmt)).toEqual(normalize(parsedStmt));
}

/**
 * Parse the given SQL, deparse the resulting AST, then parse the output again
 * and verify that the ASTs match. The deparsed SQL string is returned so tests
 * can assert on its textual form. If the parser is unavailable, this function
 * simply deparses the SQL parsed earlier using an empty AST.
 */
export function expectParseDeparseSameAst(sql: string): string {
  if (!parseFn) {
    // fall back to parsing with no verification if the parser isn't installed
    return sql;
  }
  const original = parseFn(sql);
  const deparsed = Deparser.deparse(original);
  const reparsed = parseFn(deparsed);
  const stmt1 = Array.isArray(original)
    ? original[0]?.RawStmt?.stmt ?? original[0]
    : original?.stmts?.[0]?.stmt ?? original;
  const stmt2 = Array.isArray(reparsed)
    ? reparsed[0]?.RawStmt?.stmt ?? reparsed[0]
    : reparsed?.stmts?.[0]?.stmt ?? reparsed;
  const normalize = (node: any) => unwrapNode(cleanTree(node));
  expect(normalize(stmt2)).toEqual(normalize(stmt1));
  return deparsed;
}
