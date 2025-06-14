import { Deparser } from '../src/deparser';
import { DeparserContext } from '../src/visitors/base';

describe('DDL Statement Deparsers', () => {
  const deparser = new Deparser([]);
  const context: DeparserContext = {};

  describe('CreateSchemaStmt', () => {
    it('should deparse CREATE SCHEMA statement', () => {
      const ast = {
        CreateSchemaStmt: {
          schemaname: 'test_schema',
          authrole: null as any,
          schemaElts: null as any[] | null,
          if_not_exists: false
        }
      };
      
      expect(deparser.visit(ast, context)).toBe('CREATE SCHEMA test_schema');
    });

    it('should deparse CREATE SCHEMA IF NOT EXISTS statement', () => {
      const ast = {
        CreateSchemaStmt: {
          schemaname: 'test_schema',
          authrole: null as any,
          schemaElts: null as any[] | null,
          if_not_exists: true
        }
      };
      
      expect(deparser.visit(ast, context)).toBe('CREATE SCHEMA IF NOT EXISTS test_schema');
    });

    it('should deparse CREATE SCHEMA with AUTHORIZATION', () => {
      const ast = {
        CreateSchemaStmt: {
          schemaname: 'test_schema',
          authrole: {
            RoleSpec: {
              roletype: 'ROLESPEC_CSTRING',
              rolename: 'test_user',
              location: -1
            }
          },
          schemaElts: null as any[] | null,
          if_not_exists: false
        }
      };
      
      expect(deparser.visit(ast, context)).toBe('CREATE SCHEMA test_schema AUTHORIZATION test_user');
    });

    it('should deparse CREATE SCHEMA without name (AUTHORIZATION only)', () => {
      const ast = {
        CreateSchemaStmt: {
          schemaname: null as string | null,
          authrole: {
            RoleSpec: {
              roletype: 'ROLESPEC_CSTRING',
              rolename: 'test_user',
              location: -1
            }
          },
          schemaElts: null as any[] | null,
          if_not_exists: false
        }
      };
      
      expect(deparser.visit(ast, context)).toBe('CREATE SCHEMA AUTHORIZATION test_user');
    });
  });

  describe('DropStmt', () => {
    it('should deparse DROP TABLE statement', () => {
      const ast = {
        DropStmt: {
          objects: [
            [{ String: { sval: 'users' } }]
          ],
          removeType: 'OBJECT_TABLE' as const,
          behavior: null as string | null,
          missing_ok: false,
          concurrent: false
        }
      };
      
      expect(deparser.visit(ast, context)).toBe('DROP TABLE users');
    });

    it('should deparse DROP TABLE IF EXISTS statement', () => {
      const ast = {
        DropStmt: {
          objects: [
            [{ String: { sval: 'users' } }]
          ],
          removeType: 'OBJECT_TABLE' as const,
          behavior: null as string | null,
          missing_ok: true,
          concurrent: false
        }
      };
      
      expect(deparser.visit(ast, context)).toBe('DROP TABLE IF EXISTS users');
    });

    it('should deparse DROP TABLE CASCADE statement', () => {
      const ast = {
        DropStmt: {
          objects: [
            [{ String: { sval: 'users' } }]
          ],
          removeType: 'OBJECT_TABLE' as const,
          behavior: 'DROP_CASCADE' as const,
          missing_ok: false,
          concurrent: false
        }
      };
      
      expect(deparser.visit(ast, context)).toBe('DROP TABLE users CASCADE');
    });

    it('should deparse DROP INDEX CONCURRENTLY statement', () => {
      const ast = {
        DropStmt: {
          objects: [
            [{ String: { sval: 'idx_users_email' } }]
          ],
          removeType: 'OBJECT_INDEX' as const,
          behavior: null as string | null,
          missing_ok: false,
          concurrent: true
        }
      };
      
      expect(deparser.visit(ast, context)).toBe('DROP INDEX CONCURRENTLY idx_users_email');
    });

    it('should deparse DROP SCHEMA statement', () => {
      const ast = {
        DropStmt: {
          objects: [
            [{ String: { sval: 'test_schema' } }]
          ],
          removeType: 'OBJECT_SCHEMA' as const,
          behavior: 'DROP_RESTRICT' as const,
          missing_ok: false,
          concurrent: false
        }
      };
      
      expect(deparser.visit(ast, context)).toBe('DROP SCHEMA test_schema RESTRICT');
    });

    it('should deparse DROP multiple objects statement', () => {
      const ast = {
        DropStmt: {
          objects: [
            [{ String: { sval: 'table1' } }],
            [{ String: { sval: 'table2' } }]
          ],
          removeType: 'OBJECT_TABLE' as const,
          behavior: null as string | null,
          missing_ok: false,
          concurrent: false
        }
      };
      
      expect(deparser.visit(ast, context)).toBe('DROP TABLE table1, table2');
    });

    it('should throw error for unsupported DROP object type', () => {
      const ast = {
        DropStmt: {
          objects: [
            [{ String: { sval: 'test' } }]
          ],
          removeType: 'INVALID_TYPE' as any,
          behavior: null as string | null,
          missing_ok: false,
          concurrent: false
        }
      };
      
      expect(() => deparser.visit(ast, context)).toThrow('Unsupported DROP object type: INVALID_TYPE');
    });
  });

  describe('TruncateStmt', () => {
    it('should deparse TRUNCATE statement', () => {
      const ast = {
        TruncateStmt: {
          relations: [
            {
              RangeVar: {
                schemaname: null as string | null,
                relname: 'users',
                inh: true,
                relpersistence: 'p' as const,
                alias: null as any,
                location: -1
              }
            }
          ],
          restart_seqs: false,
          behavior: null as string | null
        }
      };
      
      expect(deparser.visit(ast, context)).toBe('TRUNCATE users');
    });

    it('should deparse TRUNCATE RESTART IDENTITY statement', () => {
      const ast = {
        TruncateStmt: {
          relations: [
            {
              RangeVar: {
                schemaname: null as string | null,
                relname: 'users',
                inh: true,
                relpersistence: 'p' as const,
                alias: null as any,
                location: -1
              }
            }
          ],
          restart_seqs: true,
          behavior: null as string | null
        }
      };
      
      expect(deparser.visit(ast, context)).toBe('TRUNCATE users RESTART IDENTITY');
    });

    it('should deparse TRUNCATE CASCADE statement', () => {
      const ast = {
        TruncateStmt: {
          relations: [
            {
              RangeVar: {
                schemaname: null as string | null,
                relname: 'users',
                inh: true,
                relpersistence: 'p' as const,
                alias: null as any,
                location: -1
              }
            }
          ],
          restart_seqs: false,
          behavior: 'DROP_CASCADE' as const
        }
      };
      
      expect(deparser.visit(ast, context)).toBe('TRUNCATE users CASCADE');
    });

    it('should deparse TRUNCATE multiple tables statement', () => {
      const ast = {
        TruncateStmt: {
          relations: [
            {
              RangeVar: {
                schemaname: null as string | null,
                relname: 'users',
                inh: true,
                relpersistence: 'p' as const,
                alias: null as any,
                location: -1
              }
            },
            {
              RangeVar: {
                schemaname: null as string | null,
                relname: 'orders',
                inh: true,
                relpersistence: 'p' as const,
                alias: null as any,
                location: -1
              }
            }
          ],
          restart_seqs: false,
          behavior: null as string | null
        }
      };
      
      expect(deparser.visit(ast, context)).toBe('TRUNCATE users, orders');
    });
  });
});
