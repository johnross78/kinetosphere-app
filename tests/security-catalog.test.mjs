import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { baselineSQL, evidence } from '../security/local/catalog-loader.mjs';

test('local reconstruction retains every catalog table, policy and function body', () => {
  assert.equal(evidence.tables.length,18);
  assert.equal(evidence.policies.length,39);
  assert.equal(evidence.functions.length,11);
  const sql=baselineSQL();
  for(const f of evidence.functions) assert.ok(sql.includes(f.definition),f.name);
  for(const t of evidence.tables) assert.ok(sql.includes(`CREATE TABLE public."${t.table_name}"`),t.table_name);
  for(const p of evidence.policies) assert.ok(sql.includes(`CREATE POLICY "${p.policyname}"`),p.policyname);
});

test('reviewed SQL contains neither unresolved placeholders nor synthetic administrator', () => {
  for(const name of ['function-execute','entitlement-window','media-access','invitation-expiration']) {
    const sql=fs.readFileSync(new URL(`../security/proposals/${name}.sql`,import.meta.url),'utf8');
    assert.ok(!sql.includes('__verified_'),name);
    assert.ok(!sql.includes(evidence.redaction.synthetic_uuid),name);
  }
});
