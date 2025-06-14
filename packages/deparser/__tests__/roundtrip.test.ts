import { expectParseDeparseSameAst } from './ast-helpers';

describe('parse/deparse round trip', () => {
  it('round trips CREATE TABLE', () => {
    const sql = 'CREATE TABLE users (id int4, name text)';
    const deparsed = expectParseDeparseSameAst(sql);
    expect(deparsed).toBe(sql);
  });

  it('round trips GRANT statement', () => {
    const sql = 'GRANT SELECT ON TABLE users TO bob';
    const deparsed = expectParseDeparseSameAst(sql);
    expect(deparsed).toBe(sql);
  });

  it('round trips CREATE INDEX', () => {
    const sql = 'CREATE UNIQUE INDEX idx_users_name ON users USING BTREE (name)';
    const deparsed = expectParseDeparseSameAst(sql);
    expect(deparsed).toBe(sql);
  });

  it('round trips VACUUM FULL', () => {
    const sql = 'VACUUM (FULL) users';
    const deparsed = expectParseDeparseSameAst(sql);
    expect(deparsed).toBe(sql);
  });

  it('round trips BEGIN and COMMIT', () => {
    const sql = 'BEGIN';
    const deparsed = expectParseDeparseSameAst(sql);
    expect(deparsed).toBe(sql);
    const sql2 = 'COMMIT';
    const deparsed2 = expectParseDeparseSameAst(sql2);
    expect(deparsed2).toBe(sql2);
  });
});
