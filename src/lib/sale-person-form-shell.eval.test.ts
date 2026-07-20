import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ventaClient = readFileSync(join(root, "src/components/venta-client.tsx"), "utf8");
const flowStyles = readFileSync(join(root, "src/components/flow-form-styles.ts"), "utf8");

describe("sale person form shell eval", () => {
  it("scrolls remitente and destinatario edit forms inside the bounded venta layout", () => {
    assert.match(flowStyles, /flowPersonFormShellClass/);
    assert.match(ventaClient, /mode === "new-client" \? flowPersonFormShellClass/);
    assert.match(ventaClient, /mode === "new-recipient"\s*\?\s*flowPersonFormShellClass/);
  });
});
