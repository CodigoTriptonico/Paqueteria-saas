import assert from "node:assert/strict";
import test from "node:test";
import {
  lastFourDigits,
  publicTrackingShipment,
  senderPhoneMatches,
} from "@/lib/public-tracking";

test("public tracking accepts only the sender phone ending", () => {
  const customer = { phones: ["+1 (213) 555-7788"] };
  assert.equal(lastFourDigits(" 77-88"), "7788");
  assert.equal(senderPhoneMatches(customer, "7788"), true);
  assert.equal(senderPhoneMatches(customer, "1234"), false);
});

test("public tracking DTO omits internal revenue and operational fields", () => {
  const shipment = publicTrackingShipment({
    code: "INV-000001",
    customer_name: "Ana López",
    country: "México",
    carrier: "Terrestre",
    status: "Enviado",
    created_at: "2026-07-14T12:00:00.000Z",
    empty_box_delivered_at: null,
    full_box_collected_at: null,
    office_received_at: null,
    departed_at: null,
    shipped_at: "2026-07-14T13:00:00.000Z",
    delivered_at: null,
    logistics_plan: { boxLines: [{ label: "Mediana", quantity: 2, cost: "$5", paid: "$20" }] },
    customer: { first_name: "Ana", last_name: "López", phones: ["5551234567"], city: "Los Ángeles" },
    recipient_snapshot: { firstName: "Mario", lastName: "Ruiz", city: "Tijuana" },
    shipment_payments: [{ amount: 20, method: "cash", created_at: "2026-07-14T12:00:00.000Z" }],
  });

  assert.deepEqual(shipment.boxes, [{ label: "Mediana", quantity: 2 }]);
  assert.equal(shipment.sender.name, "A. L.");
  assert.equal(shipment.recipient.name, "M. R.");
  assert.equal(shipment.recipient.destination, "Tijuana, México");
  assert.equal(JSON.stringify(shipment).includes("5551234567"), false);
  assert.equal(JSON.stringify(shipment).includes("shipment_payments"), false);
  assert.equal(JSON.stringify(shipment).includes("cost"), false);
  assert.equal(JSON.stringify(shipment).includes("profit"), false);
  assert.equal(JSON.stringify(shipment).includes("assigned"), false);
});
