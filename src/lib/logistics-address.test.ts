import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  routeAddressForLogisticsTask,
  routeAddressFromCustomer,
} from "@/lib/logistics-address";

describe("logistics-address", () => {
  it("falls back to recipient snapshot geo when customer lacks coordinates", () => {
    const address = routeAddressForLogisticsTask(
      {
        customerId: "cust-1",
        customerName: "Ana Lopez",
        recipientSnapshot: {
          street: "Main",
          city: "LA",
          lat: 34.05,
          lng: -118.25,
          formattedAddress: "Main, LA",
          placeId: "place-1",
        },
      },
      "deliver_empty_box",
      new Map([
        [
          "cust-1",
          {
            id: "cust-1",
            first_name: "Ana",
            last_name: "Lopez",
            street: "Main",
            city: "LA",
            country: "USA",
          },
        ],
      ]),
    );

    assert.equal(address.lat, 34.05);
    assert.equal(address.lng, -118.25);
    assert.equal(address.placeId, "place-1");
    assert.equal(address.source, "customer");
  });

  it("keeps customer address when geo is present", () => {
    const customer = routeAddressFromCustomer({
      id: "cust-1",
      first_name: "Ana",
      last_name: "Lopez",
      street: "Oak",
      city: "LA",
      country: "USA",
      lat: 1,
      lng: 2,
      formatted_address: "Oak LA",
      place_id: "place-2",
    });

    assert.equal(customer?.lat, 1);
    assert.equal(customer?.lng, 2);
  });
});
