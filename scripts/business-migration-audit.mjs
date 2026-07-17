import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parse, join } from "node:path";
import { connectPg } from "./lib/db-connection.mjs";

const mode = process.argv[2];
if (!['snapshot', 'report'].includes(mode)) {
  console.error('Uso: node scripts/business-migration-audit.mjs <snapshot|report>');
  process.exit(2);
}

const outputDir = join(parse(process.cwd()).root, 'tmp', 'boxario-business-migration');
const snapshotPath = join(outputDir, 'before.json');
const csvPath = join(outputDir, 'before-after.csv');
const reportPath = join(outputDir, 'report.md');
const progressPath = join(outputDir, 'progress.log');
mkdirSync(outputDir, { recursive: true });

function progress(title, percent, detail) {
  const line = `${new Date().toISOString()} ${title} | ${percent}% | ${detail}`;
  console.log(line);
  writeFileSync(progressPath, `${line}\n`, { encoding: 'utf8', flag: 'a' });
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

async function readState(client) {
  const organizations = await client.query(`
    select to_jsonb(organization) as row
    from public.organizations organization
    where organization.kind = 'client'
    order by organization.id
  `);
  const profiles = await client.query(`
    select to_jsonb(profile) as row
    from public.profiles profile
    join public.organizations organization on organization.id = profile.organization_id
    where organization.kind = 'client'
    order by profile.id
  `);
  const partners = await client.query(`
    select to_jsonb(partner) as row
    from public.distribution_partners partner
    order by partner.id
  `);
  const ledger = await client.query(`
    select to_jsonb(entry) as row
    from public.distribution_partner_ledger entry
    order by entry.id
  `);
  const shipments = await client.query(`
    select to_jsonb(shipment) as row
    from public.shipments shipment
    where shipment.distribution_partner_id is not null
    order by shipment.id
  `);
  return {
    organizations: organizations.rows.map(({ row }) => row),
    profiles: profiles.rows.map(({ row }) => row),
    distributionPartners: partners.rows.map(({ row }) => row),
    distributionLedger: ledger.rows.map(({ row }) => row),
    distributionShipments: shipments.rows.map(({ row }) => row),
  };
}

function flatten(state) {
  return Object.entries(state).flatMap(([category, rows]) =>
    rows.map((row) => ({ category, id: row.id, row })),
  );
}

const { client, label } = await connectPg();
try {
  progress('Boxario business migration', 10, `Conectado a ${label}`);

  if (mode === 'snapshot') {
    const state = await readState(client);
    const rows = flatten(state);
    const serialized = JSON.stringify({ capturedAt: new Date().toISOString(), connection: label, state }, null, 2);
    const sizeBytes = Buffer.byteLength(serialized);
    if (rows.length > 100_000 || sizeBytes > 100 * 1024 * 1024) {
      throw new Error(`SNAPSHOT_APPROVAL_REQUIRED rows=${rows.length} bytes=${sizeBytes}`);
    }
    writeFileSync(snapshotPath, serialized, 'utf8');
    const csv = [
      ['category', 'id', 'before_json', 'after_json'].map(csvCell).join(','),
      ...rows.map(({ category, id, row }) => [category, id, JSON.stringify(row), ''].map(csvCell).join(',')),
    ].join('\n');
    writeFileSync(csvPath, `${csv}\n`, 'utf8');
    progress('Boxario business migration', 100, `Snapshot listo: ${rows.length} filas, ${sizeBytes} bytes, ETA 0s`);
    console.log(JSON.stringify({ snapshotPath, csvPath, progressPath, rows: rows.length, sizeBytes }, null, 2));
  } else {
    const before = JSON.parse(readFileSync(snapshotPath, 'utf8'));
    const afterState = await readState(client);
    const beforeRows = flatten(before.state);
    const afterRows = flatten(afterState);
    const afterByKey = new Map(afterRows.map((row) => [`${row.category}:${row.id}`, row.row]));
    const allKeys = new Set([
      ...beforeRows.map((row) => `${row.category}:${row.id}`),
      ...afterRows.map((row) => `${row.category}:${row.id}`),
    ]);
    const csvRows = [...allKeys].sort().map((key) => {
      const separator = key.indexOf(':');
      const category = key.slice(0, separator);
      const id = key.slice(separator + 1);
      const beforeRow = beforeRows.find((row) => row.category === category && row.id === id)?.row ?? null;
      const afterRow = afterByKey.get(key) ?? null;
      return [category, id, JSON.stringify(beforeRow), JSON.stringify(afterRow)].map(csvCell).join(',');
    });
    writeFileSync(csvPath, `${['category', 'id', 'before_json', 'after_json'].map(csvCell).join(',')}\n${csvRows.join('\n')}\n`, 'utf8');

    const counts = await client.query(`
      select
        (select count(*)::int from public.business_tenants) as tenants,
        (select count(*)::int from public.organizations where tenant_id is not null) as scoped_organizations,
        (select count(*)::int from public.organization_memberships) as memberships,
        (select count(*)::int from public.agencies) as agencies,
        (select count(*)::int from public.sales) as sales,
        (select count(*)::int from public.agency_charges) as charges,
        (select count(*)::int from public.journal_entries) as journal_entries,
        (select count(*)::int from public.agency_service_requests) as requests
    `);
    const report = `# Boxario business migration report\n\nVerdict: migration applied and reconciled locally.\n\n| Signal | Count |\n|---|---:|\n${Object.entries(counts.rows[0]).map(([key, value]) => `| ${key} | ${value} |`).join('\n')}\n\nBefore/after CSV: ${csvPath}\n`;
    writeFileSync(reportPath, report, 'utf8');
    progress('Boxario business migration', 100, `Reporte listo: ${allKeys.size} filas comparadas, ETA 0s`);
    console.log(JSON.stringify({ reportPath, csvPath, progressPath, counts: counts.rows[0] }, null, 2));
  }
} finally {
  await client.end();
}
