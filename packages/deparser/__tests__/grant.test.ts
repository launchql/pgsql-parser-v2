import { Deparser } from '../src/deparser';
import { expectAstMatchesParse } from "./ast-helpers";

describe('grant statements', () => {
  it('deparses simple GRANT', () => {
    const ast = {
      RawStmt: {
        stmt: {
          GrantStmt: {
            is_grant: true,
            targtype: 'ACL_TARGET_OBJECT',
            objtype: 'OBJECT_TABLE',
            objects: [{ relname: 'users' }],
            privileges: [
              { AccessPriv: { priv_name: 'select' } }
            ],
            grantees: [
              { RoleSpec: { roletype: 'ROLESPEC_CSTRING', rolename: 'bob' } }
            ],
            behavior: 'DROP_RESTRICT'
          }
        }
      }
    };
    const result = Deparser.deparse(ast);
    expect(result).toBe('GRANT SELECT ON TABLE users TO bob');
    expectAstMatchesParse('GRANT SELECT ON TABLE users TO bob', ast);
  });

  it('deparses REVOKE with grant option and cascade', () => {
    const ast = {
      RawStmt: {
        stmt: {
          GrantStmt: {
            grant_option: true,
            targtype: 'ACL_TARGET_OBJECT',
            objtype: 'OBJECT_TABLE',
            objects: [{ relname: 'users' }],
            privileges: [
              { AccessPriv: { priv_name: 'insert' } }
            ],
            grantees: [
              { RoleSpec: { roletype: 'ROLESPEC_PUBLIC' } }
            ],
            behavior: 'DROP_CASCADE'
          }
        }
      }
    };
    const result = Deparser.deparse(ast);
    expect(result).toBe('REVOKE GRANT OPTION FOR INSERT ON TABLE users FROM PUBLIC CASCADE');
    expectAstMatchesParse('REVOKE GRANT OPTION FOR INSERT ON TABLE users FROM PUBLIC CASCADE', ast);
  });

  it('deparses GRANT ROLE', () => {
    const ast = {
      RawStmt: {
        stmt: {
          GrantRoleStmt: {
            is_grant: true,
            granted_roles: [
              { AccessPriv: { priv_name: 'app_authenticated' } }
            ],
            grantee_roles: [
              { RoleSpec: { roletype: 'ROLESPEC_CSTRING', rolename: 'app_user' } }
            ],
            behavior: 'DROP_RESTRICT'
          }
        }
      }
    };
    const result = Deparser.deparse(ast);
    expect(result).toBe('GRANT APP_AUTHENTICATED TO app_user');
    expectAstMatchesParse('GRANT APP_AUTHENTICATED TO app_user', ast);
  });

  it('deparses ALTER DEFAULT PRIVILEGES', () => {
    const ast = {
      RawStmt: {
        stmt: {
          AlterDefaultPrivilegesStmt: {
            options: [
              {
                DefElem: {
                  defname: 'schemas',
                  arg: { List: { items: [{ String: { sval: 'myschema' } }] } }
                }
              },
              {
                DefElem: {
                  defname: 'roles',
                  arg: { List: { items: [{ RoleSpec: { roletype: 'ROLESPEC_CSTRING', rolename: 'app_user' } }] } }
                }
              }
            ],
            action: {
              GrantStmt: {
                is_grant: true,
                targtype: 'ACL_TARGET_DEFAULTS',
                objtype: 'OBJECT_TABLE',
                privileges: [
                  { AccessPriv: { priv_name: 'insert' } }
                ],
                grantees: [
                  { RoleSpec: { roletype: 'ROLESPEC_CSTRING', rolename: 'app_user' } }
                ],
                behavior: 'DROP_RESTRICT'
              }
            }
          }
        }
      }
    };
    const result = Deparser.deparse(ast);
    expect(result).toBe('ALTER DEFAULT PRIVILEGES IN SCHEMA myschema FOR ROLE app_user GRANT INSERT ON TABLES TO app_user');
    expectAstMatchesParse('ALTER DEFAULT PRIVILEGES IN SCHEMA myschema FOR ROLE app_user GRANT INSERT ON TABLES TO app_user', ast);
  });
});
