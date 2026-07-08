import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveRecentSendersMenuPosition } from "@/components/sale/sale-recent-senders";

describe("resolveRecentSendersMenuPosition", () => {
  it("places the recent senders menu below the button", () => {
    const position = resolveRecentSendersMenuPosition(
      { left: 88, bottom: 44 },
      { viewportWidth: 1280, viewportHeight: 720 },
    );

    assert.deepEqual(position, { left: 88, top: 50 });
  });

  it("keeps the recent senders menu inside the viewport", () => {
    const position = resolveRecentSendersMenuPosition(
      { left: 1240, bottom: 700 },
      { viewportWidth: 1280, viewportHeight: 720 },
    );

    assert.equal(position.left, 1014);
    assert.equal(position.top, 426);
  });
});
