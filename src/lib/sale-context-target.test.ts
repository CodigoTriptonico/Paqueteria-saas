import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { saleContextTargetData } from "@/lib/sale-context-target";

describe("saleContextTargetData", () => {
  it("maps the context-menu dataset once for every sale surface", () => {
    assert.deepEqual(
      saleContextTargetData({
        saleContextType: "destinatario",
        saleContextTitle: "Ana Pérez",
        saleContextKey: "recipient-1",
        saleContextPhones: "5551112222|5553334444",
        saleContextStreet: "Primera",
        saleContextHouse: "42",
        saleContextCustomerId: "customer-1",
        saleContextRecipientId: "recipient-1",
      }),
      {
        title: "Ana Pérez",
        type: "destinatario",
        targetKey: "recipient-1",
        phones: ["5551112222", "5553334444"],
        address: {
          street: "Primera",
          houseNumber: "42",
          neighborhood: undefined,
          city: undefined,
          state: undefined,
          postalCode: undefined,
          country: undefined,
        },
        firstName: "",
        lastName: "",
        customerId: "customer-1",
        recipientId: "recipient-1",
      },
    );
  });

  it("rejects incomplete and unknown context targets", () => {
    assert.equal(saleContextTargetData({ saleContextType: "otro" }), null);
    assert.equal(
      saleContextTargetData({
        saleContextType: "remitente",
        saleContextTitle: "Sin llave",
      }),
      null,
    );
  });
});
