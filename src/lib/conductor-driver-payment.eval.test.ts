import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const paymentSource = readFileSync(join(root, "src/lib/conductor-driver-payment.ts"), "utf8");
const actionSource = readFileSync(join(root, "src/app/actions/conductor-tasks.ts"), "utf8");
const clientSource = readFileSync(join(root, "src/components/conductor/conductor-tareas-client.tsx"), "utf8");

describe("conductor driver payment eval", () => {
  it("keeps the conductor choice explicit through UI, action and settlement", () => {
    assert.match(clientSource, /No recibí dinero/);
    assert.match(clientSource, /Recibí otro monto/);
    assert.match(actionSource, /conductorPaymentChoiceError/);
    assert.match(actionSource, /resolveConductorPaymentAmount/);
    assert.match(actionSource, /paymentOutcome/);
    assert.match(paymentSource, /"expected" \| "custom" \| "none"/);
    assert.match(paymentSource, /"not_collected"/);
  });
});
