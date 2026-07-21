import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  CUSTOMER_ROUTE_ZONE_CHANGE_REASON,
  resolveCustomerRouteAssignmentOutcome,
  zoneChangeShouldRevokeVerification,
} from "@/lib/customer-route-verification";

const root = process.cwd();

function migration(name: string) {
  return readFileSync(path.join(root, "supabase", "migrations", name), "utf8");
}

test("customer route verification migration covers pending approve and soft history", () => {
  const sql = migration("115_customer_route_verifications.sql");
  assert.match(sql, /create table if not exists public\.customer_route_verifications/i);
  assert.match(sql, /create table if not exists public\.customer_route_assignment_requests/i);
  assert.match(sql, /status in \('pending', 'approved', 'rejected'\)/);
  assert.match(sql, /customer_route_verifications_active_uidx/);
  assert.match(sql, /customer_route_assignment_requests_pending_task_uidx/);
  assert.match(sql, /sales\.manage/);
});

test("eval: first assignment pending, verified auto, zone change revokes", () => {
  assert.equal(
    resolveCustomerRouteAssignmentOutcome({
      verification: null,
      routeTemplateId: "a",
      currentZoneKey: "zona-1",
    }),
    "pending_approval",
  );
  assert.equal(
    resolveCustomerRouteAssignmentOutcome({
      verification: { routeTemplateId: "a", zoneKey: "zona-1", endedAt: null },
      routeTemplateId: "a",
      currentZoneKey: "zona-1",
    }),
    "assigned",
  );
  assert.equal(
    zoneChangeShouldRevokeVerification({
      previousZoneKey: "zona-1",
      nextZoneKey: "zona-2",
    }),
    true,
  );
  assert.match(CUSTOMER_ROUTE_ZONE_CHANGE_REASON, /dirección|zona/i);
});
