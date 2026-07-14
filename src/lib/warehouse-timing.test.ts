import assert from "node:assert/strict";
import test from "node:test";
import { formatWarehouseDateTime, formatWarehouseElapsed } from "@/lib/warehouse-timing";

test("warehouse timing uses readable Spanish dates and phase durations", () => {
  const arrival = "2026-07-12T15:00:00.000Z";
  const unload = "2026-07-12T16:35:00.000Z";
  assert.match(formatWarehouseDateTime(arrival), /julio/i);
  assert.equal(formatWarehouseElapsed(arrival, unload), "1 h 35 min");
});

test("warehouse timing leaves incomplete phases pending", () => {
  assert.equal(formatWarehouseElapsed(null, "2026-07-12T16:35:00.000Z"), "Pendiente");
  assert.equal(formatWarehouseDateTime(null), "Sin registrar");
});
