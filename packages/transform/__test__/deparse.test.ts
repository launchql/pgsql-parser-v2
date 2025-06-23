// this the deparser for PG17
import { deparse } from '../../deparser/src';

// this is the type of the AST for PG13
import { SelectStmt } from 'libpg-query';

// import the transformer
import { transformPG13ToPG17 } from '../src/index';

xdescribe('PG13 to PG17 transformer', () => {

    it('should deparse a select statement', async () => {
        const stmt: { SelectStmt: SelectStmt } = {
            SelectStmt: {
                targetList: [{ ResTarget: { val: { ColumnRef: { fields: [{ A_Star: {} }] } } } }],
                fromClause: [{ RangeVar: { relname: 'users' } }],
                limitOption: 'LIMIT_OPTION_DEFAULT',
                op: 'SETOP_NONE'
            }
        }
        // transform the PG13 AST to a PG17 AST
        const pg17Stmt = transformPG13ToPG17(stmt as any);
        const deparsed = await deparse(pg17Stmt);
        expect(deparsed).toBe('SELECT * FROM ONLY users');
    });

    it('should deparse a select statement with WHERE clause', async () => {
        const stmt: { SelectStmt: SelectStmt } = {
            SelectStmt: {
                targetList: [
                    { 
                        ResTarget: { 
                            val: { 
                                ColumnRef: { 
                                    fields: [
                                        { String: { str: 'name' } }
                                    ] 
                                } 
                            } 
                        } 
                    }
                ],
                fromClause: [{ RangeVar: { relname: 'users' } }],
                whereClause: {
                    A_Expr: {
                        kind: 'AEXPR_OP',
                        name: [{ String: { str: '=' } }],
                        lexpr: {
                            ColumnRef: {
                                fields: [{ String: { str: 'id' } }]
                            }
                        },
                        rexpr: {
                            A_Const: {
                                val: { Integer: { ival: 1 } }
                            }
                        }
                    }
                },
                limitOption: 'LIMIT_OPTION_DEFAULT',
                op: 'SETOP_NONE'
            }
        };
        
        const pg17Stmt = transformPG13ToPG17(stmt as any);
        const deparsed = await deparse(pg17Stmt);
        expect(deparsed).toBe('SELECT name FROM ONLY users WHERE id = 1');
    });

    it('should deparse a select statement with JOIN', async () => {
        const stmt: { SelectStmt: SelectStmt } = {
            SelectStmt: {
                targetList: [{ ResTarget: { val: { ColumnRef: { fields: [{ A_Star: {} }] } } } }],
                fromClause: [
                    {
                        JoinExpr: {
                            jointype: 'JOIN_INNER',
                            larg: { RangeVar: { relname: 'users' } },
                            rarg: { RangeVar: { relname: 'posts' } },
                            quals: {
                                A_Expr: {
                                    kind: 'AEXPR_OP',
                                    name: [{ String: { str: '=' } }],
                                    lexpr: {
                                        ColumnRef: {
                                            fields: [
                                                { String: { str: 'users' } },
                                                { String: { str: 'id' } }
                                            ]
                                        }
                                    },
                                    rexpr: {
                                        ColumnRef: {
                                            fields: [
                                                { String: { str: 'posts' } },
                                                { String: { str: 'user_id' } }
                                            ]
                                        }
                                    }
                                }
                            }
                        }
                    }
                ],
                limitOption: 'LIMIT_OPTION_DEFAULT',
                op: 'SETOP_NONE'
            }
        };
        
        const pg17Stmt = transformPG13ToPG17(stmt as any);
        const deparsed = await deparse(pg17Stmt);
        expect(deparsed).toBe('SELECT * FROM ONLY users JOIN ONLY posts ON users.id = posts.user_id');
    });
});