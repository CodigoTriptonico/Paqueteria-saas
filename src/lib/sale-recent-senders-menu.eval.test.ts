import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const recentSendersSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/sale/sale-recent-senders.tsx"),
  "utf8",
);

describe("sale recent senders menu eval", () => {
  it("keeps recents as one toolbar button with a floating menu", () => {
    assert.equal(recentSendersSource.includes('aria-label="Abrir remitentes recientes"'), true);
    assert.equal(recentSendersSource.includes('aria-haspopup="menu"'), true);
    assert.equal(recentSendersSource.includes("createPortal"), true);
    assert.equal(recentSendersSource.includes('role="menu"'), true);
    assert.equal(recentSendersSource.includes("resolveRecentSendersMenuPosition"), true);
  });

  it("moves sender choices out of the toolbar into the menu", () => {
    const menuIndex = recentSendersSource.indexOf('role="menu"');
    const senderMapIndex = recentSendersSource.indexOf("senders.map((sender)");

    assert.ok(menuIndex > -1);
    assert.ok(senderMapIndex > menuIndex);
    assert.equal(recentSendersSource.includes("max-h-72 w-[16.25rem]"), true);
  });
});
