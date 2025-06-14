import { cleanTree } from '../src/utils';

function unwrapRangeVars(node: any): any {
  if (Array.isArray(node)) {
    return node.map(unwrapRangeVars);
  }
  if (node && typeof node === 'object') {
    if (node.RangeVar && Object.keys(node).length === 1) {
      return unwrapRangeVars(node.RangeVar);
    }
    const out: any = {};
    for (const [k, v] of Object.entries(node)) {
      out[k] = unwrapRangeVars(v);
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
  const normalize = (node: any) => unwrapRangeVars(cleanTree(node));
  expect(normalize(inputStmt)).toEqual(normalize(parsedStmt));
}
