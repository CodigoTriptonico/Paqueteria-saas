import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();

describe("restored logistics contracts eval", () => {
  it("keeps the recovered route, schedule, billing and geo contracts connected", () => {
    const routeCatalog = readFileSync(join(root, "src/lib/logistics-route-catalog.ts"), "utf8");
    const scheduleWindow = readFileSync(join(root, "src/lib/logistics-schedule-window.ts"), "utf8");
    const billing = readFileSync(join(root, "src/lib/invoice-billing.ts"), "utf8");
    const address = readFileSync(join(root, "src/lib/logistics-address.ts"), "utf8");

    assert.match(routeCatalog, /"Lun"/);
    assert.match(routeCatalog, /isLogisticsWeekdayKey/);
    assert.match(scheduleWindow, /schedule_confirmation_status: "pending"/);
    assert.match(billing, /billingWithRecordedPayment/);
    assert.match(billing, /invoiceAccountingStateForPayment/);
    assert.match(address, /buildLogisticsGeoAddressPatch/);
  });
});
