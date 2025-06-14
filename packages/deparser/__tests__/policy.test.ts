import { expectParseDeparseSameAst } from './ast-helpers';

describe('policy statements', () => {
  it('deparses CREATE POLICY with USING clause', () => {
    const sql = 'CREATE POLICY user_active ON users FOR SELECT TO PUBLIC USING (is_active)';
    const deparsed = expectParseDeparseSameAst(sql);
    expect(deparsed).toBe(sql);
  });

  it('deparses CREATE POLICY restrictive with check', () => {
    const sql = 'CREATE POLICY update_owner ON users AS RESTRICTIVE FOR UPDATE TO admin WITH CHECK (owner_id = 1)';
    const deparsed = expectParseDeparseSameAst(sql);
    expect(deparsed).toBe(sql);
  });

  it('deparses ALTER POLICY', () => {
    const sql = 'ALTER POLICY user_active ON users TO manager USING (is_active)';
    const deparsed = expectParseDeparseSameAst(sql);
    expect(deparsed).toBe(sql);
  });
});
