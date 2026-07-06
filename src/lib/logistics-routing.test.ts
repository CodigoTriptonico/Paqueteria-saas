import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  distanceKm,
  logisticsZoneKey,
  logisticsZoneLabel,
  orderStopsByProximity,
  statusAfterRouteUnassign,
  suggestLogisticsRoutes,
  type LogisticsRouteTaskInput,
} from "./logistics-routing";
import {
  routeAddressForLogisticsTask,
  routeAddressFromCustomer,
  routeAddressFromRecipientSnapshot,
} from "./logistics-address";

function task(input: {
  id: string;
  code?: string;
  city: string;
  zip: string;
  lat: number | null;
  lng: number | null;
  date?: string | null;
  warehouseId?: string | null;
}): LogisticsRouteTaskInput {
  return {
    taskId: input.id,
    shipmentId: `shipment-${input.id}`,
    shipmentCode: input.code || input.id,
    customerName: `Cliente ${input.id}`,
    taskType: "deliver_empty_box",
    scheduledAt: input.date === null ? null : input.date || "2026-07-01T10:00:00.000Z",
    warehouseId: input.warehouseId || null,
    assignedTo: null,
    address: {
      source: "customer",
      name: `Cliente ${input.id}`,
      phone: "555",
      street: "Main",
      houseNumber: "1",
      neighborhood: "",
      city: input.city,
      state: "CA",
      postalCode: input.zip,
      country: "USA",
      formattedAddress: `${input.city} ${input.zip}`,
      placeId: `place-${input.id}`,
      lat: input.lat,
      lng: input.lng,
    },
  };
}

describe("logistics address mapper", () => {
  it("maps customer geo into a route address", () => {
    const address = routeAddressFromCustomer({
      id: "c1",
      first_name: "Ana",
      last_name: "Lopez",
      phones: ["+15550001"],
      street: "10 Main St",
      house_number: "A",
      city: "Los Angeles",
      state: "CA",
      postal_code: "90001",
      country: "USA",
      formatted_address: "10 Main St A, Los Angeles, CA 90001, USA",
      place_id: "abc",
      lat: "34.01",
      lng: "-118.24",
    });

    assert.equal(address?.name, "Ana Lopez");
    assert.equal(address?.phone, "+15550001");
    assert.equal(address?.formattedAddress, "10 Main St A, Los Angeles, CA 90001, USA");
    assert.equal(address?.lat, 34.01);
    assert.equal(address?.lng, -118.24);
  });

  it("falls back to recipient snapshot when shipment has no customer address", () => {
    const address = routeAddressForLogisticsTask(
      {
        customerId: "missing",
        customerName: "Fallback Name",
        recipientSnapshot: {
          firstName: "Mario",
          lastName: "Rios",
          city: "Fresno",
          postalCode: "93701",
          lat: 36.74,
          lng: -119.78,
        },
      },
      "deliver_empty_box",
      new Map(),
    );

    assert.equal(address.source, "recipient_snapshot");
    assert.equal(address.name, "Mario Rios");
    assert.equal(address.city, "Fresno");
  });

  it("builds a readable address when formatted address is missing", () => {
    const address = routeAddressFromRecipientSnapshot({
      street: "Oak",
      houseNumber: "4",
      city: "Anaheim",
      state: "CA",
      postalCode: "92805",
      country: "USA",
    });

    assert.equal(address.formattedAddress, "Oak 4, Anaheim CA 92805, USA");
  });
});

describe("logistics routing", () => {
  it("builds stable zone keys from city and zip prefix", () => {
    assert.equal(logisticsZoneKey(task({ id: "a", city: "Los Angeles", zip: "90001", lat: 1, lng: 1 }).address), "los-angeles-900");
    assert.equal(logisticsZoneKey(task({ id: "b", city: "México Norte", zip: "", lat: 1, lng: 1 }).address), "mexico-norte-sin-cp");
    assert.equal(logisticsZoneKey(task({ id: "c", city: "LA", zip: "90001", lat: null, lng: null }).address), "falta-geo");
  });

  it("uses zip prefix for route buckets", () => {
    const address = task({
      id: "sc",
      city: "Santa Clarita",
      zip: "91387",
      lat: 34.4,
      lng: -118.5,
    }).address;

    assert.equal(logisticsZoneKey(address), "santa-clarita-913");
    assert.equal(logisticsZoneLabel(address), "Santa Clarita");
  });

  it("orders stops by nearest next point", () => {
    const ordered = orderStopsByProximity([
      task({ id: "far", city: "A", zip: "900", lat: 34.2, lng: -118.4 }),
      task({ id: "start", city: "A", zip: "900", lat: 34.0, lng: -118.2 }),
      task({ id: "middle", city: "A", zip: "900", lat: 34.05, lng: -118.25 }),
    ]);

    assert.deepEqual(ordered.map((entry) => entry.taskId), ["middle", "start", "far"]);
    assert.ok(distanceKm({ lat: 34, lng: -118.2 }, { lat: 34.05, lng: -118.25 }) > 0);
  });

  it("suggests route groups and excludes stops without geo", () => {
    const fixture = [
      ...Array.from({ length: 8 }, (_, index) =>
        task({
          id: `la-${index}`,
          city: "Los Angeles",
          zip: "90001",
          lat: 34.01 + index * 0.001,
          lng: -118.24 - index * 0.001,
        }),
      ),
      ...Array.from({ length: 7 }, (_, index) =>
        task({
          id: `ana-${index}`,
          city: "Anaheim",
          zip: "92805",
          lat: 33.83 + index * 0.001,
          lng: -117.91 - index * 0.001,
        }),
      ),
      ...Array.from({ length: 3 }, (_, index) =>
        task({
          id: `riv-${index}`,
          city: "Riverside",
          zip: "92501",
          lat: 33.98 + index * 0.001,
          lng: -117.37 - index * 0.001,
        }),
      ),
      task({ id: "nogeo-1", city: "Los Angeles", zip: "90001", lat: null, lng: null }),
      task({ id: "nogeo-2", city: "Anaheim", zip: "92805", lat: null, lng: null }),
    ];

    const suggestions = suggestLogisticsRoutes(fixture, {
      fallbackDate: "2026-07-01",
      minimumStops: 2,
    });

    assert.equal(suggestions.length, 3);
    assert.deepEqual(
      suggestions.map((suggestion) => suggestion.stopCount).sort((a, b) => b - a),
      [8, 7, 3],
    );
    assert.equal(
      suggestions.some((suggestion) => suggestion.taskIds.includes("nogeo-1")),
      false,
    );
  });

  it("reverts route assignment only for assigned tasks", () => {
    assert.equal(statusAfterRouteUnassign("assigned", "2026-07-01T10:00:00.000Z"), "scheduled");
    assert.equal(statusAfterRouteUnassign("assigned", null), "pending");
    assert.equal(statusAfterRouteUnassign("loaded_to_truck", null), "loaded_to_truck");
  });
});

describe("logistics route action eval", () => {
  it("filters route candidates to current invoice steps", () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../app/actions/logistics-routes.ts"),
      "utf8",
    );

    assert.match(source, /activeLogisticsRouteTaskIds/);
    assert.equal((source.match(/onlyCurrentStep: true/g) || []).length, 3);
  });
});
