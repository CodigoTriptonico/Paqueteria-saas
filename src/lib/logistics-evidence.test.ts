import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapLogisticsEvidenceFromHistory } from "@/lib/logistics-evidence";

describe("logistics-evidence", () => {
  it("maps activity history rows with evidence urls", () => {
    const items = mapLogisticsEvidenceFromHistory([
      {
        id: "1",
        title: "Tarea",
        created_at: "2026-07-08T10:00:00.000Z",
        metadata: {
          evidenceUrl: "https://example.com/photo.jpg",
          shipmentCode: "INV-1",
          taskId: "task-1",
        },
      },
      {
        id: "2",
        title: "Sin foto",
        created_at: "2026-07-08T10:00:00.000Z",
        metadata: {},
      },
    ]);

    assert.equal(items.length, 1);
    assert.equal(items[0]?.shipmentCode, "INV-1");
  });
});
