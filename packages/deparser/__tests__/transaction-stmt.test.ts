import { Deparser } from '../src/deparser';
import { DeparserContext } from '../src/visitors/base';

describe('TransactionStmt Deparser', () => {
  const deparser = new Deparser([]);
  const context: DeparserContext = {};

  it('should deparse BEGIN statement', () => {
    const ast = {
      TransactionStmt: {
        kind: 'TRANS_STMT_BEGIN' as const,
        options: [] as any[],
        savepoint_name: null as string | null,
        gid: null as string | null,
        chain: false,
        location: -1
      }
    };
    
    expect(deparser.visit(ast, context)).toBe('BEGIN');
  });

  it('should deparse START TRANSACTION statement', () => {
    const ast = {
      TransactionStmt: {
        kind: 'TRANS_STMT_START' as const,
        options: [] as any[],
        savepoint_name: null as string | null,
        gid: null as string | null,
        chain: false,
        location: -1
      }
    };
    
    expect(deparser.visit(ast, context)).toBe('START TRANSACTION');
  });

  it('should deparse COMMIT statement', () => {
    const ast = {
      TransactionStmt: {
        kind: 'TRANS_STMT_COMMIT' as const,
        options: [] as any[],
        savepoint_name: null as string | null,
        gid: null as string | null,
        chain: false,
        location: -1
      }
    };
    
    expect(deparser.visit(ast, context)).toBe('COMMIT');
  });

  it('should deparse ROLLBACK statement', () => {
    const ast = {
      TransactionStmt: {
        kind: 'TRANS_STMT_ROLLBACK' as const,
        options: [] as any[],
        savepoint_name: null as string | null,
        gid: null as string | null,
        chain: false,
        location: -1
      }
    };
    
    expect(deparser.visit(ast, context)).toBe('ROLLBACK');
  });

  it('should deparse SAVEPOINT statement', () => {
    const ast = {
      TransactionStmt: {
        kind: 'TRANS_STMT_SAVEPOINT' as const,
        options: [] as any[],
        savepoint_name: 'sp1' as string | null,
        gid: null as string | null,
        chain: false,
        location: -1
      }
    };
    
    expect(deparser.visit(ast, context)).toBe('SAVEPOINT sp1');
  });

  it('should deparse RELEASE SAVEPOINT statement', () => {
    const ast = {
      TransactionStmt: {
        kind: 'TRANS_STMT_RELEASE' as const,
        options: [] as any[],
        savepoint_name: 'sp1' as string | null,
        gid: null as string | null,
        chain: false,
        location: -1
      }
    };
    
    expect(deparser.visit(ast, context)).toBe('RELEASE SAVEPOINT sp1');
  });

  it('should deparse ROLLBACK TO statement', () => {
    const ast = {
      TransactionStmt: {
        kind: 'TRANS_STMT_ROLLBACK_TO' as const,
        options: [] as any[],
        savepoint_name: 'sp1' as string | null,
        gid: null as string | null,
        chain: false,
        location: -1
      }
    };
    
    expect(deparser.visit(ast, context)).toBe('ROLLBACK TO sp1');
  });

  it('should deparse PREPARE TRANSACTION statement', () => {
    const ast = {
      TransactionStmt: {
        kind: 'TRANS_STMT_PREPARE' as const,
        options: [] as any[],
        savepoint_name: null as string | null,
        gid: 'test_gid' as string | null,
        chain: false,
        location: -1
      }
    };
    
    expect(deparser.visit(ast, context)).toBe('PREPARE TRANSACTION \'test_gid\'');
  });

  it('should deparse COMMIT PREPARED statement', () => {
    const ast = {
      TransactionStmt: {
        kind: 'TRANS_STMT_COMMIT_PREPARED' as const,
        options: [] as any[],
        savepoint_name: null as string | null,
        gid: 'test_gid' as string | null,
        chain: false,
        location: -1
      }
    };
    
    expect(deparser.visit(ast, context)).toBe('COMMIT PREPARED \'test_gid\'');
  });

  it('should deparse ROLLBACK PREPARED statement', () => {
    const ast = {
      TransactionStmt: {
        kind: 'TRANS_STMT_ROLLBACK_PREPARED' as const,
        options: [] as any[],
        savepoint_name: null as string | null,
        gid: 'test_gid' as string | null,
        chain: false,
        location: -1
      }
    };
    
    expect(deparser.visit(ast, context)).toBe('ROLLBACK PREPARED \'test_gid\'');
  });

  it('should throw error for unsupported transaction statement kind', () => {
    const ast = {
      TransactionStmt: {
        kind: 'INVALID_KIND' as any,
        options: [] as any[],
        savepoint_name: null as string | null,
        gid: null as string | null,
        chain: false,
        location: -1
      }
    };
    
    expect(() => deparser.visit(ast, context)).toThrow('Unsupported TransactionStmt kind: INVALID_KIND');
  });
});
