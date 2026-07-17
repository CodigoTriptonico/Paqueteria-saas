import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatInitialTeamPlan,
  initialAdditionalUserLimit,
  initialTeamPlan,
  initialTeamUserLimit,
} from "@/lib/organizations/initial-team-plan";

describe("initial team plan", () => {
  it("includes one owner and two seats for each operational area", () => {
    assert.deepEqual(
      initialTeamPlan.map(({ label, capacity }) => ({ label, capacity })),
      [
        { label: "Administrador", capacity: 1 },
        { label: "Vendedores", capacity: 2 },
        { label: "Conductores", capacity: 2 },
        { label: "Captadores de agencias", capacity: 2 },
      ],
    );
    assert.equal(initialAdditionalUserLimit, 6);
    assert.equal(initialTeamUserLimit, 7);
  });

  it("formats the plan for the creation summary", () => {
    assert.equal(
      formatInitialTeamPlan(),
      "1 administrador · 2 vendedores · 2 conductores · 2 captadores de agencias",
    );
  });
});
