import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { applicationSource, extractFunction } from './helpers/prescription-runtime.mjs';

// These tests capture CLIENT visibility only. No database/RLS security is asserted.
function client({ user = { app_metadata: {} }, role, entitlement } = {}) {
  const names = [
    ['isAdminUser', 'function isOwnerUser('],
    ['providerMemberRole', 'function providerCan('],
    ['providerCan', '// Step 5'],
    ['providerAccessState', 'function providerAccessLabel('],
    ['providerHasAccess', 'function providerActionLabel('],
    ['providerSampleProgramIds', 'function providerSampleExerciseIds('],
    ['providerForSource', 'function programAccessibleForCurrentUser('],
    ['programAccessibleForCurrentUser', 'function providerSampleContentHtml('],
  ];
  const capabilityStart = applicationSource.indexOf('const PROVIDER_ROLE_CAPABILITIES=');
  assert.ok(capabilityStart >= 0, 'Missing production role-capability map');
  const capabilities = applicationSource.slice(capabilityStart, applicationSource.indexOf('function providerMemberRole(', capabilityStart));
  const definitions = names.map(([name, end]) => extractFunction(applicationSource, name, end)).join('\n');
  const statusStart = applicationSource.indexOf('const ACTIVE_ENTITLEMENT_STATUSES=');
  assert.ok(statusStart >= 0, 'Missing production entitlement status sets');
  const statuses = applicationSource.slice(statusStart, applicationSource.indexOf('function providerSourceAccessible(', statusStart));
  return vm.runInNewContext(`
    const cloudUser = user;
    const providerMembersByProvider = new Map(role ? [['provider-a', {role}]] : []);
    const providerEntitlementsByProvider = new Map(entitlement ? [['provider-a', entitlement]] : []);
    const providerCatalog = [{id:'provider-a',source_key:'Provider A',access_model:'subscription'}];
    ${statuses}
    ${capabilities}
    ${definitions}
    ({providerAccessState, providerCan, programAccessibleForCurrentUser})
  `, { user, role, entitlement }, { timeout: 1000 });
}
const provider = { id: 'provider-a', access_model: 'subscription', free_sample_enabled: false };

test('client denies protected provider visibility for a free authenticated member', () => {
  assert.equal(client().providerAccessState(provider).hasFullAccess, false);
});
for (const status of ['active', 'trialing', 'comped']) {
  test(`existing client gap: ${status} ignores an already elapsed ends_at`, () => {
    const r = client({ entitlement: { status, starts_at: '2000-01-01T00:00:00Z', ends_at: '2000-01-02T00:00:00Z' } });
    assert.equal(r.providerAccessState(provider).hasFullAccess, true);
  });
}
test('existing client gap: future-start active subscription is visible', () => {
  assert.equal(client({ entitlement: { status: 'active', starts_at: '2999-01-01T00:00:00Z' } }).providerAccessState(provider).hasFullAccess, true);
});
test('existing client gap: canceled subscription is denied even with future ends_at', () => {
  assert.equal(client({ entitlement: { status: 'canceled', ends_at: '2999-01-01T00:00:00Z' } }).providerAccessState(provider).hasFullAccess, false);
});
test('client explicitly denies expired subscription and unknown program provider passes visibility', () => {
  const r = client({ entitlement: { status: 'expired' } });
  assert.equal(r.providerAccessState(provider).hasFullAccess, false);
  assert.equal(r.programAccessibleForCurrentUser({ source: 'Unmapped provider' }), true);
  assert.equal(r.programAccessibleForCurrentUser({ source: 'Provider A' }), false);
});
for (const [role, edit, manage, analytics] of [
  ['editor', true, false, false], ['admin', true, false, true],
  ['owner', true, true, true], ['analyst', false, false, true],
]) {
  test(`client ${role} capabilities are scoped to its own provider`, () => {
    const r = client({ role });
    assert.equal(r.providerCan('provider-a', 'storefront:edit'), edit);
    assert.equal(r.providerCan('provider-a', 'members:manage'), manage);
    assert.equal(r.providerCan('provider-a', 'analytics:view'), analytics);
    assert.equal(r.providerCan('provider-b', 'storefront:edit'), false);
    assert.equal(r.providerCan('provider-b', 'members:manage'), false);
  });
}
test('client admin visibility uses app_metadata; editable user_metadata does not confer admin', () => {
  assert.equal(client({ user: { user_metadata: { admin: true } } }).providerCan('provider-b', 'members:manage'), false);
  assert.equal(client({ user: { app_metadata: { admin: true } } }).providerCan('provider-b', 'members:manage'), true);
});
test('recorded database report is current and does not claim production certification', () => {
  const output = execFileSync(process.execPath, [new URL('../scripts/check-security-evidence.mjs', import.meta.url).pathname], { encoding: 'utf8' });
  assert.match(output, /RECORDED LOCAL VALIDATION/);
  assert.match(output, /did not rerun/);
  assert.match(output, /Production-equivalent certification remains BLOCKED/);
});
