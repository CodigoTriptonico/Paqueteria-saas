import assert from "node:assert/strict";
import test from "node:test";
import {
  CUSTOMER_ROUTE_PENDING_APPROVAL_LABEL,
  customerHasRouteGeo,
  customerRouteVerificationMatchesZone,
  customerZoneKeyFromParts,
  resolveCustomerRouteAssignmentOutcome,
  shouldAutoAcceptCustomerRouteAssignment,
  zoneChangeShouldRevokeVerification,
} from "@/lib/customer-route-verification";

test("customer zone key matches logistics zone rules", () => {
  assert.equal(
    customerZoneKeyFromParts({
      city: "Los Angeles",
      postalCode: "90012",
      lat: 34.05,
      lng: -118.24,
    }),
    "los-angeles-900",
  );
  assert.equal(
    customerZoneKeyFromParts({
      city: "Los Angeles",
      postalCode: "90012",
      lat: null,
      lng: null,
    }),
    "falta-geo",
  );
  assert.equal(customerHasRouteGeo({ city: "X", postalCode: "1", lat: 1, lng: 2 }), true);
});

test("first assignment without verification stays pending for logistics", () => {
  assert.equal(
    resolveCustomerRouteAssignmentOutcome({
      verification: null,
      routeTemplateId: "tpl-dom",
      currentZoneKey: "los-angeles-900",
    }),
    "pending_approval",
  );
});

test("verified remitent on same route and zone auto-accepts", () => {
  const verification = {
    routeTemplateId: "tpl-dom",
    zoneKey: "los-angeles-900",
    endedAt: null,
  };

  assert.equal(
    shouldAutoAcceptCustomerRouteAssignment({
      verification,
      routeTemplateId: "tpl-dom",
      currentZoneKey: "los-angeles-900",
    }),
    true,
  );
  assert.equal(
    resolveCustomerRouteAssignmentOutcome({
      verification,
      routeTemplateId: "tpl-dom",
      currentZoneKey: "los-angeles-900",
    }),
    "assigned",
  );
});

test("verified remitent on a different route stays pending", () => {
  assert.equal(
    shouldAutoAcceptCustomerRouteAssignment({
      verification: {
        routeTemplateId: "tpl-dom",
        zoneKey: "los-angeles-900",
        endedAt: null,
      },
      routeTemplateId: "tpl-lun",
      currentZoneKey: "los-angeles-900",
    }),
    false,
  );
});

test("zone mismatch or revoked verification does not auto-accept", () => {
  assert.equal(
    customerRouteVerificationMatchesZone(
      { zoneKey: "los-angeles-900", endedAt: null },
      "anaheim-928",
    ),
    false,
  );
  assert.equal(
    shouldAutoAcceptCustomerRouteAssignment({
      verification: {
        routeTemplateId: "tpl-dom",
        zoneKey: "los-angeles-900",
        endedAt: "2026-07-01T00:00:00.000Z",
      },
      routeTemplateId: "tpl-dom",
      currentZoneKey: "los-angeles-900",
    }),
    false,
  );
  assert.equal(
    shouldAutoAcceptCustomerRouteAssignment({
      verification: {
        routeTemplateId: "tpl-dom",
        zoneKey: "falta-geo",
        endedAt: null,
      },
      routeTemplateId: "tpl-dom",
      currentZoneKey: "falta-geo",
    }),
    false,
  );
});

test("address zone change triggers verification revoke", () => {
  assert.equal(
    zoneChangeShouldRevokeVerification({
      previousZoneKey: "los-angeles-900",
      nextZoneKey: "anaheim-928",
    }),
    true,
  );
  assert.equal(
    zoneChangeShouldRevokeVerification({
      previousZoneKey: "los-angeles-900",
      nextZoneKey: "los-angeles-900",
    }),
    false,
  );
});

test("pending approval label is stable for UI", () => {
  assert.match(CUSTOMER_ROUTE_PENDING_APPROVAL_LABEL, /aprobación logística/i);
});
