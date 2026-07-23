import assert from 'node:assert/strict';
import { connectPg } from './lib/db-connection.mjs';

const { client, label } = await connectPg();
console.log(`Testing Boxario business model on ${label}`);

let authScopeCounter = 0;

async function authenticated(userId, task) {
  authScopeCounter += 1;
  const savepoint = `authenticated_scope_${authScopeCounter}`;
  await client.query(`savepoint ${savepoint}`);
  await client.query('set local role authenticated');
  await client.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: userId, role: 'authenticated' }),
  ]);
  try {
    const result = await task();
    await client.query('reset role');
    await client.query(`release savepoint ${savepoint}`);
    return result;
  } catch (error) {
    await client.query(`rollback to savepoint ${savepoint}`);
    await client.query('reset role');
    await client.query(`release savepoint ${savepoint}`);
    throw error;
  }
}

await client.query('begin');
try {
  const matrix = await client.query(`
    select organization.id, organization.tenant_id, profile.id as admin_user_id
    from public.organizations organization
    join public.profiles profile on profile.organization_id = organization.id
    join public.roles role on role.id = profile.role_id and role.slug = 'administrador'
    where organization.organization_type = 'matrix'
    order by profile.created_at
    limit 1
  `);
  assert.equal(matrix.rowCount, 1, 'matrix administrator required');
  const context = matrix.rows[0];

  const platform = await client.query(`
    select platform_admin.user_id
    from public.platform_admins platform_admin
    limit 1
  `);
  assert.equal(platform.rowCount, 1, 'platform administrator required');

  const membershipDuplicates = await client.query(`
    select user_id, count(*)::int as active_count
    from public.organization_memberships
    where status = 'active' and ended_at is null
    group by user_id having count(*) > 1
  `);
  assert.equal(membershipDuplicates.rowCount, 0, 'one active membership per identity');

  const secondTenantId = '22222222-2222-4222-8222-222222222222';
  const secondMatrixId = '33333333-3333-4333-8333-333333333333';
  await client.query(
    "insert into public.business_tenants(id, code, name) values ($1, 'ENVIAMGS-QA', 'Enviamgs QA')",
    [secondTenantId],
  );
  await client.query(`
    insert into public.organizations(
      id, name, slug, kind, is_active, tenant_id, organization_type,
      organization_code, organization_status, matrix_organization_id
    ) values ($2, 'Enviamgs QA', 'enviamgs-qa', 'client', true, $1, 'matrix', 'ENVIAMGS-QA', 'active', $2)
  `, [secondTenantId, secondMatrixId]);
  await client.query(
    'update public.business_tenants set matrix_organization_id = $2 where id = $1',
    [secondTenantId, secondMatrixId],
  );

  await authenticated(context.admin_user_id, async () => {
    const tenantVisibility = await client.query('select id from public.business_tenants order by id');
    assert.deepEqual(tenantVisibility.rows.map((row) => row.id), [context.tenant_id]);

    const workspace = await client.query('select public.load_business_workspace($1) as data', [context.id]);
    const data = workspace.rows[0].data;
    assert.equal(data.context.tenantId, context.tenant_id);
    assert.equal(data.context.organizationType, 'matrix');
    assert.equal(data.metrics.unbalancedJournalEntries, 0);
    assert.equal(data.metrics.activeHolds, 0);
  });

  await authenticated(platform.rows[0].user_id, async () => {
    const tenantVisibility = await client.query('select count(*)::int as count from public.business_tenants');
    assert.equal(tenantVisibility.rows[0].count, 2, 'platform admin sees both tenants');

    const workspace = await client.query('select public.load_business_workspace($1) as data', [context.id]);
    assert.equal(workspace.rows[0].data.context.tenantId, context.tenant_id);

    await client.query("select public.archive_business_organization($1, 'Prueba transaccional con rollback')", [context.id]);
    const archived = await client.query('select is_active, organization_status from public.organizations where id = $1', [context.id]);
    assert.deepEqual(archived.rows[0], { is_active: false, organization_status: 'closed' });
  });

  const accountingSignals = await client.query(`
    select
      (select count(*)::int from (
        select entry.id from public.journal_entries entry
        join public.journal_lines line on line.journal_entry_id = entry.id
        group by entry.id having sum(line.debit_cents) <> sum(line.credit_cents)
      ) rows) as unbalanced_entries,
      (select count(*)::int from (
        select tenant_id, operation_type, idempotency_key
        from public.idempotency_operations
        group by tenant_id, operation_type, idempotency_key having count(*) > 1
      ) rows) as duplicate_operations
  `);
  assert.deepEqual(accountingSignals.rows[0], { unbalanced_entries: 0, duplicate_operations: 0 });

  console.log(JSON.stringify({
    tenantIsolation: 'pass',
    platformVisibility: 'pass',
    oneActiveMembership: 'pass',
    archiveRollback: 'pass',
    unbalancedEntries: 0,
    duplicateOperations: 0,
  }, null, 2));
} finally {
  await client.query('rollback');
  await client.end();
}
