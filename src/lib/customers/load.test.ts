import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  groupRecipientsByCustomerId,
  mapCustomerRow,
  mergeCustomersWithRecipients,
} from "@/lib/customers/load";

describe("mergeCustomersWithRecipients", () => {
  it("groups recipients by customer id", () => {
    const grouped = groupRecipientsByCustomerId([
      {
        id: "r-1",
        customer_id: "c-1",
        first_name: "Ana",
        last_name: "Lopez",
        phone: "+1",
        country: "Mexico",
        street: "A",
        house_number: "1",
        neighborhood: "Centro",
        city: "CDMX",
        state: "CDMX",
        postal_code: "01000",
        card_style: "amber-warm",
      },
      {
        id: "r-2",
        customer_id: "c-2",
        first_name: "Luis",
        last_name: "Perez",
        phone: "+2",
        country: "Mexico",
        street: "B",
        house_number: "2",
        neighborhood: "Centro",
        city: "GDL",
        state: "Jalisco",
        postal_code: "44100",
        card_style: "amber-warm",
      },
    ]);

    assert.equal(grouped.get("c-1")?.length, 1);
    assert.equal(grouped.get("c-2")?.length, 1);
  });

  it("merges recipients into customer rows", () => {
    const merged = mergeCustomersWithRecipients(
      [
        {
          id: "c-1",
          referred_by_customer_id: null,
          first_name: "Maria",
          last_name: "Gonzalez",
          phones: ["+1"],
          email: "",
          street: "Main",
          house_number: "10",
          neighborhood: "Centro",
          city: "LA",
          state: "CA",
          postal_code: "90001",
          country: "USA",
          card_style: "amber-warm",
          customer_recipients: null,
        },
      ],
      [
        {
          id: "r-1",
          customer_id: "c-1",
          first_name: "Pedro",
          last_name: "Ruiz",
          phone: "+52",
          country: "Mexico",
          street: "Reforma",
          house_number: "20",
          neighborhood: "Centro",
          city: "CDMX",
          state: "CDMX",
          postal_code: "01000",
          card_style: "amber-warm",
        },
      ],
    );

    assert.equal(merged.length, 1);
    assert.equal(merged[0]?.recipients.length, 1);
    assert.equal(merged[0]?.recipients[0]?.firstName, "Pedro");
    assert.equal(
      mapCustomerRow({
        id: "c-2",
        referred_by_customer_id: null,
        first_name: "Sin",
        last_name: "Destino",
        phones: ["+1"],
        email: "",
        street: "",
        house_number: "",
        neighborhood: "",
        city: "",
        state: "",
        postal_code: "",
        country: "USA",
        card_style: "amber-warm",
        customer_recipients: [],
      }).recipients.length,
      0,
    );
  });
});
