import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ShipmentRow } from "@/app/actions/shipments";
import {
  enviosDisplayOrderStorageKey,
  resolveEnviosDisplayOrderIds,
  shipmentDisplayOrderFilterSignature,
  storedEnviosDisplayOrderMatchesRows,
} from "./envios-display-order";

function row(id: string, createdAt: string, invoicePriority = false): Pick<ShipmentRow, "id" | "created_at" | "invoice_priority"> {
  return {
    id,
    created_at: createdAt,
    invoice_priority: invoicePriority,
  };
}

describe("envios display order", () => {
  it("builds a stable storage key from active filters", () => {
    const signature = shipmentDisplayOrderFilterSignature({
      query: "INV-1",
      country: "MX",
      statusFilter: "Pendiente",
      salesOwnerFilter: "seller-1",
    });

    assert.equal(signature.includes("INV-1"), true);
    assert.equal(enviosDisplayOrderStorageKey(signature).startsWith("envios:display-order:"), true);
  });

  it("restores a stored order when the visible set still matches", () => {
    const rows = [
      row("b", "2026-03-02T12:00:00.000Z"),
      row("a", "2026-03-10T12:00:00.000Z", true),
    ];

    assert.equal(storedEnviosDisplayOrderMatchesRows(["b", "a"], rows), true);
    assert.deepEqual(
      resolveEnviosDisplayOrderIds(rows, {
        storedOrderIds: ["b", "a"],
      }),
      ["b", "a"],
    );
  });

  it("keeps the previous order when only invoice_priority changes", () => {
    const rows = [
      row("middle", "2026-03-05T12:00:00.000Z", false),
      row("top", "2026-03-10T12:00:00.000Z", true),
    ];

    assert.deepEqual(
      resolveEnviosDisplayOrderIds(rows, {
        previousOrderIds: ["middle", "top"],
      }),
      ["middle", "top"],
    );

    assert.deepEqual(
      resolveEnviosDisplayOrderIds(
        [
          row("middle", "2026-03-05T12:00:00.000Z", true),
          row("top", "2026-03-10T12:00:00.000Z", false),
        ],
        {
          previousOrderIds: ["middle", "top"],
        },
      ),
      ["middle", "top"],
    );
  });

  it("re-sorts by arrival when filters change", () => {
    const rows = [
      row("old", "2026-03-01T12:00:00.000Z"),
      row("new", "2026-03-10T12:00:00.000Z"),
    ];

    assert.deepEqual(
      resolveEnviosDisplayOrderIds(rows, {
        previousOrderIds: ["old", "new"],
        filterChanged: true,
      }),
      ["new", "old"],
    );
  });
});
