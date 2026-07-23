#!/usr/bin/env node
import { connectPg } from "./lib/db-connection.mjs";

const { client, label } = await connectPg();
const failures = [];

async function check(name, sql, expected) {
  const { rows } = await client.query(sql);
  const actual = Number(rows[0]?.count || 0);
  if (actual !== expected) failures.push(`${name}: expected ${expected}, got ${actual}`);
}

try {
  await check(
    "unsafe default privileges",
    `select count(*)::int
       from pg_default_acl
       cross join lateral aclexplode(
         coalesce(defaclacl, acldefault(defaclobjtype, defaclrole))
       ) acl
      where defaclnamespace = 'public'::regnamespace
        and acl.grantee in ('anon'::regrole, 'authenticated'::regrole)`,
    0,
  );
  await check(
    "anonymous sensitive function execution",
    `select count(*)::int
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and (
          p.proname like 'finance_%'
          or p.proname in (
            'grant_platform_admin', 'bootstrap_organization',
            'initialize_business_matrix_organization',
            'initialize_captor_agency_organization',
            'record_shipment_package_invoice_event',
            'record_shipment_package_invoice_state'
          )
        )
        and has_function_privilege('anon', p.oid, 'EXECUTE')`,
    0,
  );
  await check(
    "required RLS disabled",
    `select count(*)::int
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname in (
          'agency_route_proposals', 'driver_settlement_reversals',
          'warehouse_intake_counters', 'time_clock_auth_events',
          'shipment_sale_operations', 'security_audit_events'
        )
        and not c.relrowsecurity`,
    0,
  );
  await check(
    "missing atomic sale tables",
    `select count(*)::int
       from (values ('shipment_sale_operations'), ('security_audit_events')) required(name)
       left join pg_class c
         on c.relnamespace = 'public'::regnamespace
        and c.relname = required.name
        and c.relkind = 'r'
      where c.oid is null`,
    0,
  );
  await check(
    "missing public tracking token columns",
    `select count(*)::int
       from (
         values
           ('public_tracking_token_hash'),
           ('public_tracking_expires_at'),
           ('public_tracking_revoked_at')
       ) required(name)
       left join information_schema.columns c
         on c.table_schema = 'public'
        and c.table_name = 'shipments'
        and c.column_name = required.name
      where c.column_name is null`,
    0,
  );
  await check(
    "missing authoritative write triggers",
    `select count(*)::int
       from (
         values
           ('shipments_authoritative_write_guard'),
           ('inventory_stock_direct_write_guard'),
           ('security_audit_events_immutable'),
           ('shipment_sale_operations_immutable')
       ) required(name)
       left join pg_trigger t
         on t.tgname = required.name
        and not t.tgisinternal
      where t.oid is null or t.tgenabled = 'D'`,
    0,
  );
  await check(
    "unsafe atomic sale function execution",
    `select count(*)::int
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in (
          'create_shipment_sale_atomic',
          'guard_authoritative_shipment_writes',
          'guard_inventory_stock_direct_write',
          'reject_immutable_security_row_change'
        )
        and (
          has_function_privilege('anon', p.oid, 'EXECUTE')
          or has_function_privilege('authenticated', p.oid, 'EXECUTE')
        )`,
    0,
  );
  await check(
    "non-null-safe authoritative guards",
    `select count(*)::int
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in (
          'guard_authoritative_shipment_writes',
          'guard_inventory_stock_direct_write'
        )
        and position(
          'auth.role() is distinct from ''authenticated'''
          in lower(pg_get_functiondef(p.oid))
        ) = 0`,
    0,
  );
  await check(
    "profile command owner bypass missing",
    `select count(*)::int
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'guard_profile_authorization_fields'
        and (
          position(
            'current_user in (''postgres'', ''supabase_admin'')'
            in lower(pg_get_functiondef(p.oid))
          ) = 0
          or position(
            'profile_self_authorization_fields_forbidden'
            in lower(pg_get_functiondef(p.oid))
          ) = 0
        )`,
    0,
  );
  await check(
    "authenticated direct payment writes",
    `select count(*)::int
       from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name = 'shipment_payments'
        and grantee = 'authenticated'
        and privilege_type in ('INSERT', 'UPDATE', 'DELETE')`,
    0,
  );
  await check(
    "public inventory photo bucket",
    `select count(*)::int from storage.buckets
      where id = 'inventory-item-photos' and public`,
    0,
  );
} finally {
  await client.end();
}

if (failures.length) {
  console.error(`SECURITY CATALOG CHECK FAILED (${label})`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`SECURITY CATALOG CHECK PASSED (${label})`);
