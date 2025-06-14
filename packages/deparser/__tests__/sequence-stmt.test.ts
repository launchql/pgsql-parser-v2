import { Deparser } from '../src/deparser';
import { DeparserContext } from '../src/visitors/base';

describe('Sequence Statement Deparsers', () => {
  const deparser = new Deparser([]);
  const context: DeparserContext = {};

  describe('CreateSeqStmt', () => {
    it('should deparse CREATE SEQUENCE statement', () => {
      const ast = {
        CreateSeqStmt: {
          sequence: {
            RangeVar: {
              schemaname: null as string | null,
              relname: 'test_seq',
              inh: true,
              relpersistence: 'p',
              alias: null as any,
              location: -1
            }
          },
          options: [] as any[],
          ownerId: 0,
          for_identity: false,
          if_not_exists: false
        }
      };
      
      expect(deparser.visit(ast, context)).toBe('CREATE SEQUENCE test_seq');
    });

    it('should deparse CREATE SEQUENCE IF NOT EXISTS statement', () => {
      const ast = {
        CreateSeqStmt: {
          sequence: {
            RangeVar: {
              schemaname: 'public',
              relname: 'my_sequence',
              inh: true,
              relpersistence: 'p',
              alias: null as any,
              location: -1
            }
          },
          options: [] as any[],
          ownerId: 0,
          for_identity: false,
          if_not_exists: true
        }
      };
      
      expect(deparser.visit(ast, context)).toBe('CREATE SEQUENCE IF NOT EXISTS public.my_sequence');
    });

    it('should deparse CREATE SEQUENCE with options', () => {
      const ast = {
        CreateSeqStmt: {
          sequence: {
            RangeVar: {
              schemaname: null as string | null,
              relname: 'counter_seq',
              inh: true,
              relpersistence: 'p',
              alias: null as any,
              location: -1
            }
          },
          options: [
            {
              DefElem: {
                defnamespace: null as string | null,
                defname: 'start',
                arg: { Integer: { ival: 100 } },
                defaction: 'DEFELEM_UNSPEC',
                location: -1
              }
            },
            {
              DefElem: {
                defnamespace: null as string | null,
                defname: 'increment',
                arg: { Integer: { ival: 5 } },
                defaction: 'DEFELEM_UNSPEC',
                location: -1
              }
            }
          ],
          ownerId: 0,
          for_identity: false,
          if_not_exists: false
        }
      };
      
      expect(deparser.visit(ast, context)).toBe('CREATE SEQUENCE counter_seq START 100 INCREMENT 5');
    });
  });

  describe('AlterSeqStmt', () => {
    it('should deparse ALTER SEQUENCE statement', () => {
      const ast = {
        AlterSeqStmt: {
          sequence: {
            RangeVar: {
              schemaname: null as string | null,
              relname: 'test_seq',
              inh: true,
              relpersistence: 'p',
              alias: null as any,
              location: -1
            }
          },
          options: [
            {
              DefElem: {
                defnamespace: null as string | null,
                defname: 'restart',
                arg: { Integer: { ival: 1 } },
                defaction: 'DEFELEM_UNSPEC',
                location: -1
              }
            }
          ],
          for_identity: false,
          missing_ok: false
        }
      };
      
      expect(deparser.visit(ast, context)).toBe('ALTER SEQUENCE test_seq RESTART 1');
    });

    it('should deparse ALTER SEQUENCE IF EXISTS statement', () => {
      const ast = {
        AlterSeqStmt: {
          sequence: {
            RangeVar: {
              schemaname: 'public',
              relname: 'my_seq',
              inh: true,
              relpersistence: 'p',
              alias: null as any,
              location: -1
            }
          },
          options: [] as any[],
          for_identity: false,
          missing_ok: true
        }
      };
      
      expect(deparser.visit(ast, context)).toBe('ALTER SEQUENCE IF EXISTS public.my_seq');
    });

    it('should deparse ALTER SEQUENCE FOR IDENTITY statement', () => {
      const ast = {
        AlterSeqStmt: {
          sequence: {
            RangeVar: {
              schemaname: null as string | null,
              relname: 'identity_seq',
              inh: true,
              relpersistence: 'p',
              alias: null as any,
              location: -1
            }
          },
          options: [
            {
              DefElem: {
                defnamespace: null as string | null,
                defname: 'maxvalue',
                arg: { Integer: { ival: 1000 } },
                defaction: 'DEFELEM_UNSPEC',
                location: -1
              }
            }
          ],
          for_identity: true,
          missing_ok: false
        }
      };
      
      expect(deparser.visit(ast, context)).toBe('ALTER SEQUENCE identity_seq MAXVALUE 1000 FOR IDENTITY');
    });
  });
});
