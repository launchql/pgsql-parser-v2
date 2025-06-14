import { Deparser } from '../src/deparser';
import { expectAstMatchesParse } from "./ast-helpers";

describe('index and schema statements', () => {
  it('deparses CREATE INDEX', () => {
    const ast = {
      RawStmt: {
        stmt: {
          IndexStmt: {
            idxname: 'idx_users_name',
            relation: { relname: 'users' },
            accessMethod: 'btree',
            unique: true,
            indexParams: [
              { IndexElem: { name: 'name' } }
            ]
          }
        }
      }
    };
    const result = Deparser.deparse(ast);
    expect(result).toBe('CREATE UNIQUE INDEX idx_users_name ON users USING BTREE (name)');
    expectAstMatchesParse('CREATE UNIQUE INDEX idx_users_name ON users USING BTREE (name)', ast);
  });

  it('deparses CREATE SCHEMA IF NOT EXISTS', () => {
    const ast = {
      RawStmt: {
        stmt: {
          CreateSchemaStmt: {
            schemaname: 'myschema',
            if_not_exists: true
          }
        }
      }
    };
    const result = Deparser.deparse(ast);
    expect(result).toBe('CREATE SCHEMA IF NOT EXISTS myschema');
    expectAstMatchesParse('CREATE SCHEMA IF NOT EXISTS myschema', ast);
  });
});
