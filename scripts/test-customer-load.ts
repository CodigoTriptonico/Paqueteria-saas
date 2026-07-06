import assert from "node:assert/strict";
import { loadEnvLocal } from "./lib/db-connection.mjs";
import { listCustomersForSession } from "../src/lib/customers/load";
import type { AppSession } from "../src/lib/auth/types";

loadEnvLocal();

const SCGS_ORG = "2029bf0c-e766-4840-9d90-f4b252cc3fe9";

function actingSession(): AppSession {
  return {
    userId: "test-user",
    email: "test@boxario.test",
    fullName: "Test",
    organizationId: SCGS_ORG,
    organizationName: "Scgs",
    homeOrganizationId: "e6d15c28-1d30-4fb3-ab06-79d4af8014f0",
    homeOrganizationName: "Boxario",
    actingOrganizationId: SCGS_ORG,
    actingOrganizationName: "Scgs",
    isActingAsClient: true,
    multiWarehouseEnabled: false,
    maxWarehouses: 1,
    roleSlug: "administrador",
    roleName: "Vista plataforma",
    permissions: ["all", "sales.manage", "customers.manage"],
    warehouseIds: [],
    preferredWarehouseId: null,
    isPlatformAdmin: true,
  };
}

async function main() {
  const rows = await listCustomersForSession(actingSession());
  const withRecipients = rows.filter((row) => row.recipients.length > 0);
  const totalRecipients = rows.reduce((sum, row) => sum + row.recipients.length, 0);

  console.log(
    JSON.stringify(
      {
        customers: rows.length,
        customersWithRecipients: withRecipients.length,
        totalRecipients,
        sample: withRecipients.slice(0, 3).map((row) => ({
          name: `${row.firstName} ${row.lastName}`,
          recipients: row.recipients.length,
        })),
      },
      null,
      2,
    ),
  );

  assert.ok(withRecipients.length > 0, "expected customers with recipients");
  assert.ok(totalRecipients > 0, "expected recipient rows");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
