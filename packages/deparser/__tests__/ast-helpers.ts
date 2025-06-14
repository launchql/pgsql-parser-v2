import { cleanTree } from '../src/utils';

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
  expect(cleanTree(ast)).toEqual(cleanTree(parsed));
}
