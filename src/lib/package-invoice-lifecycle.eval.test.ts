import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("every child invoice state is immutable, timestamped and attributed", async () => {
  const [migration, packagesAction, warehouseClient, shipmentsAction, conductorAction] = await Promise.all([
    readFile(new URL("../../supabase/migrations/082_package_invoice_lifecycle.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/actions/physical-packages.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/warehouse/warehouse-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/actions/shipments.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/actions/conductor-tasks.ts", import.meta.url), "utf8"),
  ]);

  assert.match(migration, /shipment_package_invoice_events/);
  assert.match(migration, /state in \('created', 'paid', 'in_warehouse', 'in_transit', 'delivered'\)/);
  assert.match(migration, /occurred_at timestamptz not null/);
  assert.match(migration, /changed_by uuid references public\.profiles/);
  assert.match(migration, /after update of invoice_status, status on public\.shipments/);
  assert.match(migration, /after update of status on public\.shipment_packages/);
  assert.match(packagesAction, /shipment_package_invoice_events/);
  assert.match(warehouseClient, /PackageInvoiceTimeline/);
  assert.match(shipmentsAction, /invoice_created_by: session\.userId/);
  assert.match(conductorAction, /record_shipment_package_invoice_state/);
});
