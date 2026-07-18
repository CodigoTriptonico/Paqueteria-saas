import assert from "node:assert/strict";
import test from "node:test";
import { closeDifferenceMessage, exceptionNeedsSecondApproval } from "@/lib/controlled-operations";

test("only high-impact operational exceptions require a second approval", () => {
  assert.equal(exceptionNeedsSecondApproval("not_delivered"), false);
  assert.equal(exceptionNeedsSecondApproval("damaged"), true);
  assert.equal(exceptionNeedsSecondApproval("lost"), true);
  assert.equal(exceptionNeedsSecondApproval("weight_difference"), true);
  assert.equal(exceptionNeedsSecondApproval("cancel_pre_departure"), true);
});

test("daily close difference stays deterministic in cents", () => {
  assert.equal(closeDifferenceMessage(1000, 1000), "Caja cuadrada");
  assert.equal(closeDifferenceMessage(1000, 950), "Faltan 50 centavos");
  assert.equal(closeDifferenceMessage(1000, 1050), "Sobra 50 centavos");
});
