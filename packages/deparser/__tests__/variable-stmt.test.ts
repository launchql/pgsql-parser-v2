import { Deparser } from '../src/deparser';
import { DeparserContext } from '../src/visitors/base';

describe('Variable Statement Deparsers', () => {
  const deparser = new Deparser([]);
  const context: DeparserContext = {};

  describe('VariableSetStmt', () => {
    it('should deparse SET variable = value statement', () => {
      const ast = {
        VariableSetStmt: {
          kind: 'VAR_SET_VALUE',
          name: 'timezone',
          args: [{ String: { sval: 'UTC' } }],
          is_local: false
        }
      };
      
      expect(deparser.visit(ast, context)).toBe('SET timezone = UTC');
    });

    it('should deparse SET LOCAL variable = value statement', () => {
      const ast = {
        VariableSetStmt: {
          kind: 'VAR_SET_VALUE',
          name: 'work_mem',
          args: [{ String: { sval: '64MB' } }],
          is_local: true
        }
      };
      
      expect(deparser.visit(ast, context)).toBe('SET LOCAL work_mem = 64MB');
    });

    it('should deparse SET variable TO DEFAULT statement', () => {
      const ast = {
        VariableSetStmt: {
          kind: 'VAR_SET_DEFAULT',
          name: 'timezone',
          args: null as any[] | null,
          is_local: false
        }
      };
      
      expect(deparser.visit(ast, context)).toBe('SET timezone TO DEFAULT');
    });

    it('should deparse SET variable FROM CURRENT statement', () => {
      const ast = {
        VariableSetStmt: {
          kind: 'VAR_SET_CURRENT',
          name: 'timezone',
          args: null as any[] | null,
          is_local: false
        }
      };
      
      expect(deparser.visit(ast, context)).toBe('SET timezone FROM CURRENT');
    });

    it('should deparse RESET variable statement', () => {
      const ast = {
        VariableSetStmt: {
          kind: 'VAR_RESET',
          name: 'timezone',
          args: null as any[] | null,
          is_local: false
        }
      };
      
      expect(deparser.visit(ast, context)).toBe('RESET timezone');
    });

    it('should deparse RESET ALL statement', () => {
      const ast = {
        VariableSetStmt: {
          kind: 'VAR_RESET_ALL',
          name: null as string | null,
          args: null as any[] | null,
          is_local: false
        }
      };
      
      expect(deparser.visit(ast, context)).toBe('RESET ALL');
    });

    it('should throw error for unsupported variable set kind', () => {
      const ast = {
        VariableSetStmt: {
          kind: 'INVALID_KIND' as any,
          name: 'test',
          args: null as any[] | null,
          is_local: false
        }
      };
      
      expect(() => deparser.visit(ast, context)).toThrow('Unsupported VariableSetStmt kind: INVALID_KIND');
    });
  });

  describe('VariableShowStmt', () => {
    it('should deparse SHOW variable statement', () => {
      const ast = {
        VariableShowStmt: {
          name: 'timezone'
        }
      };
      
      expect(deparser.visit(ast, context)).toBe('SHOW timezone');
    });

    it('should deparse SHOW ALL statement', () => {
      const ast = {
        VariableShowStmt: {
          name: 'ALL'
        }
      };
      
      expect(deparser.visit(ast, context)).toBe('SHOW ALL');
    });

    it('should deparse SHOW with complex variable name', () => {
      const ast = {
        VariableShowStmt: {
          name: 'log_statement'
        }
      };
      
      expect(deparser.visit(ast, context)).toBe('SHOW log_statement');
    });
  });
});
