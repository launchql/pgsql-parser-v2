import { Deparser } from '../src/deparser';

describe('transaction and drop statements', () => {
  it('deparses BEGIN', () => {
    const ast = {
      RawStmt: { stmt: { TransactionStmt: { kind: 'TRANS_STMT_BEGIN' } }, stmt_location: 0 }
    };
    const result = Deparser.deparse(ast);
    expect(result).toBe('BEGIN');
  });

  it('deparses COMMIT AND CHAIN', () => {
    const ast = {
      RawStmt: { stmt: { TransactionStmt: { kind: 'TRANS_STMT_COMMIT', chain: true } } }
    };
    const result = Deparser.deparse(ast);
    expect(result).toBe('COMMIT AND CHAIN');
  });

  it('deparses DROP TABLE', () => {
    const ast = {
      RawStmt: {
        stmt: {
          DropStmt: {
            removeType: 'OBJECT_TABLE',
            objects: [[{ String: { sval: 'users' } }]],
            behavior: 'DROP_RESTRICT'
          }
        }
      }
    };
    const result = Deparser.deparse(ast);
    expect(result).toBe('DROP TABLE users');
  });

  it('deparses DROP INDEX with options', () => {
    const ast = {
      RawStmt: {
        stmt: {
          DropStmt: {
            removeType: 'OBJECT_INDEX',
            concurrent: true,
            missing_ok: true,
            behavior: 'DROP_CASCADE',
            objects: [[{ String: { sval: 'idx_users_name' } }]]
          }
        }
      }
    };
    const result = Deparser.deparse(ast);
    expect(result).toBe('DROP INDEX CONCURRENTLY IF EXISTS idx_users_name CASCADE');
  });

  it('deparses TRUNCATE with restart and cascade', () => {
    const ast = {
      RawStmt: {
        stmt: {
          TruncateStmt: {
            relations: [{ relname: 'logs' }],
            restart_seqs: true,
            behavior: 'DROP_CASCADE'
          }
        }
      }
    };
    const result = Deparser.deparse(ast);
    expect(result).toBe('TRUNCATE logs RESTART IDENTITY CASCADE');
  });
});
