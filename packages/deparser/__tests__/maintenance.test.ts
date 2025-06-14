import { Deparser } from '../src/deparser';
import { expectAstMatchesParse } from "./ast-helpers";

describe('maintenance and utility statements', () => {
  it('deparses VACUUM FULL', () => {
    const ast = {
      RawStmt: {
        stmt: {
          VacuumStmt: {
            is_vacuumcmd: true,
            options: [{ DefElem: { defname: 'full' } }],
            rels: [
              { VacuumRelation: { relation: { relname: 'users' } } }
            ]
          }
        }
      }
    } as any;
    const result = Deparser.deparse(ast);
    expect(result).toBe('VACUUM (FULL) users');
    expectAstMatchesParse('VACUUM (FULL) users', ast);
  });

  it('deparses ANALYZE VERBOSE with columns', () => {
    const ast = {
      RawStmt: {
        stmt: {
          VacuumStmt: {
            is_vacuumcmd: false,
            options: [{ DefElem: { defname: 'verbose' } }],
            rels: [
              {
                VacuumRelation: {
                  relation: { relname: 'books' },
                  va_cols: [
                    { String: { sval: 'title' } },
                    { String: { sval: 'author' } }
                  ]
                }
              }
            ]
          }
        }
      }
    } as any;
    const result = Deparser.deparse(ast);
    expect(result).toBe('ANALYZE (VERBOSE) books(title, author)');
    expectAstMatchesParse('ANALYZE (VERBOSE) books(title, author)', ast);
  });

  it('deparses EXPLAIN SELECT', () => {
    const ast = {
      RawStmt: {
        stmt: {
          ExplainStmt: {
            options: [{ DefElem: { defname: 'analyze' } }],
            query: {
              SelectStmt: {
                targetList: [
                  {
                    ResTarget: {
                      val: { A_Const: { ival: { ival: 1 } } }
                    }
                  }
                ],
                limitOption: 'LIMIT_OPTION_DEFAULT',
                op: 'SETOP_NONE'
              }
              }
          }
        }
      }
    } as any;
    const result = Deparser.deparse(ast);
    expect(result).toBe('EXPLAIN (ANALYZE) SELECT 1');
    expectAstMatchesParse('EXPLAIN (ANALYZE) SELECT 1', ast);
  });

  it('deparses SET statement', () => {
    const ast = {
      RawStmt: {
        stmt: {
          VariableSetStmt: {
            kind: 'VAR_SET_VALUE',
            name: 'application_name',
            args: [{ A_Const: { sval: { sval: 'myapp' } } }]
          }
        }
      }
    } as any;
    const result = Deparser.deparse(ast);
    expect(result).toBe("SET application_name = 'myapp'");
    expectAstMatchesParse("SET application_name = 'myapp'", ast);
  });

  it('deparses SHOW statement', () => {
    const ast = {
      RawStmt: {
        stmt: {
          VariableShowStmt: {
            name: 'search_path'
          }
        }
      }
    } as any;
    const result = Deparser.deparse(ast);
    expect(result).toBe('SHOW search_path');
    expectAstMatchesParse('SHOW search_path', ast);
  });

  it('deparses CREATE EXTENSION IF NOT EXISTS', () => {
    const ast = {
      RawStmt: {
        stmt: {
          CreateExtensionStmt: {
            extname: 'hstore',
            if_not_exists: true
          }
        }
      }
    } as any;
    const result = Deparser.deparse(ast);
    expect(result).toBe('CREATE EXTENSION IF NOT EXISTS hstore');
    expectAstMatchesParse('CREATE EXTENSION IF NOT EXISTS hstore', ast);
  });
});
