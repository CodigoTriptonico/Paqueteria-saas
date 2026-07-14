import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { OnboardingProgress } from "@/app/actions/onboarding";
import { resolveOnboardingGuideForStep } from "@/lib/onboarding/micro-steps";

function baseProgress(overrides: Partial<OnboardingProgress> = {}): OnboardingProgress {
  return {
    eligible: true,
    dismissed: false,
    steps: [
      { id: "countries", title: "", description: "", href: "", completed: false },
      { id: "inventory", title: "", description: "", href: "", completed: false },
      { id: "pricing", title: "", description: "", href: "", completed: false },
      { id: "stock", title: "", description: "", href: "", completed: false },
      { id: "first_sale", title: "", description: "", href: "", completed: false },
    ],
    completedCount: 0,
    totalCount: 5,
    pendingCount: 5,
    allComplete: false,
    inventoryHasCategory: false,
    inventoryHasItems: false,
    firstCountryName: "México",
    ...overrides,
  };
}

describe("onboarding micro steps", () => {
  it("points pricing on inventario to the return flow", () => {
    const guide = resolveOnboardingGuideForStep(
      "pricing",
      "/inventario",
      new URLSearchParams("returnTo=%2Fconfiguracion%3Fview%3Dprices%26country%3DM%C3%A9xico"),
      baseProgress(),
    );

    assert.ok(guide);
    assert.equal(guide?.microStepIndex, 3);
    assert.match(guide?.body ?? "", /Volver a precios/);
    assert.match(guide?.actionHref ?? "", /returnTo=/);
  });

  it("uses the country prices href when configuring pricing", () => {
    const guide = resolveOnboardingGuideForStep(
      "pricing",
      "/configuracion",
      new URLSearchParams("view=prices&country=M%C3%A9xico"),
      baseProgress(),
    );

    assert.ok(guide);
    assert.equal(guide?.microStepIndex, 4);
    assert.match(guide?.actionHref ?? "", /country=M/);
  });

  it("describes the embedded inventory structure menu", () => {
    const guide = resolveOnboardingGuideForStep(
      "inventory",
      "/inventario",
      new URLSearchParams(),
      baseProgress({ inventoryHasCategory: true }),
    );

    assert.ok(guide);
    assert.match(guide?.body ?? "", /Nuevo item/);
  });
});
