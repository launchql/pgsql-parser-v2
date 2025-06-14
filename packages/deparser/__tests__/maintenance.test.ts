import { Deparser } from '../src/deparser';

describe('maintenance and utility statements', () => {
  it('deparses VACUUM FULL', () => {
    const ast = {
      RawStmt: {
        stmt: {
          VacuumStmt: {
            is_vacuumcmd: true,
            options: [{ DefElem: { defname: 'full' } }],
            rels: [
              { VacuumRelation: { relation: { RangeVar: { relname: 'users' } } } }
            ]
          }
        }
      }
    } as any;
    const result = Deparser.deparse(ast);
    expect(result).toBe('VACUUM (FULL) users');
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
                  relation: { RangeVar: { relname: 'books' } },
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
            ]
          }
        }
      }
    } as any;
    const result = Deparser.deparse(ast);
    expect(result).toBe('EXPLAIN (ANALYZE) SELECT 1');
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
  });
});
