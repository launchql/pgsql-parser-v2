import { Deparser } from '../src/deparser';
import { expectAstMatchesParse } from "./ast-helpers";

describe('policy statements', () => {
  it('deparses CREATE POLICY with USING clause', () => {
    const ast = {
      RawStmt: {
        stmt: {
          CreatePolicyStmt: {
            policy_name: 'user_active',
            table: { relname: 'users' },
            cmd_name: 'select',
            roles: [
              { RoleSpec: { roletype: 'ROLESPEC_PUBLIC' } }
            ],
            qual: {
              ColumnRef: { fields: [{ String: { sval: 'is_active' } }] }
            }
          }
        }
      }
    };
    const result = Deparser.deparse(ast);
    expect(result).toBe('CREATE POLICY user_active ON users FOR SELECT TO PUBLIC USING (is_active)');
    expectAstMatchesParse('CREATE POLICY user_active ON users FOR SELECT TO PUBLIC USING (is_active)', ast);
  });

  it('deparses CREATE POLICY restrictive with check', () => {
    const ast = {
      RawStmt: {
        stmt: {
          CreatePolicyStmt: {
            policy_name: 'update_owner',
            table: { relname: 'users' },
            cmd_name: 'update',
            permissive: false,
            roles: [
              { RoleSpec: { roletype: 'ROLESPEC_CSTRING', rolename: 'admin' } }
            ],
            with_check: {
              A_Expr: {
                kind: 'AEXPR_OP',
                name: [{ String: { sval: '=' } }],
                lexpr: { ColumnRef: { fields: [{ String: { sval: 'owner_id' } }] } },
                rexpr: { A_Const: { ival: { ival: 1 } } }
              }
            }
          }
        }
      }
    };
    const result = Deparser.deparse(ast);
    expect(result).toBe('CREATE POLICY update_owner ON users AS RESTRICTIVE FOR UPDATE TO admin WITH CHECK (owner_id = 1)');
    expectAstMatchesParse('CREATE POLICY update_owner ON users AS RESTRICTIVE FOR UPDATE TO admin WITH CHECK (owner_id = 1)', ast);
  });

  it('deparses ALTER POLICY', () => {
    const ast = {
      RawStmt: {
        stmt: {
          AlterPolicyStmt: {
            policy_name: 'user_active',
            table: { relname: 'users' },
            roles: [
              { RoleSpec: { roletype: 'ROLESPEC_CSTRING', rolename: 'manager' } }
            ],
            qual: {
              ColumnRef: { fields: [{ String: { sval: 'is_active' } }] }
            }
          }
        }
      }
    };
    const result = Deparser.deparse(ast);
    expect(result).toBe('ALTER POLICY user_active ON users TO manager USING (is_active)');
    expectAstMatchesParse('ALTER POLICY user_active ON users TO manager USING (is_active)', ast);
  });
});
