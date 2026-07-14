import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { OnboardingMicroStepState } from "@/lib/onboarding/micro-steps";
import {
  ONBOARDING_COACH_IDLE_MS,
  ONBOARDING_TARGETS,
  computeCoachTooltipPosition,
  resolveOnboardingCoachHint,
} from "@/lib/onboarding/coach-targets";

function guide(
  stepId: OnboardingMicroStepState["stepId"],
  microStepIndex: number,
  title = "Paso",
  body = "Instrucción",
): OnboardingMicroStepState {
  return {
    stepId,
    stepNumber: 1,
    microStepIndex,
    microStepTotal: 3,
    title,
    body,
    checklist: [],
    actionHref: "/configuracion",
    actionLabel: "Ir a Configuración",
  };
}

describe("onboarding coach targets", () => {
  it("uses a readable twelve second idle delay", () => {
    assert.equal(ONBOARDING_COACH_IDLE_MS, 12_000);
  });

  it("highlights configuracion nav on countries step one", () => {
    const hint = resolveOnboardingCoachHint(
      guide("countries", 1),
      "/",
      new URLSearchParams(),
    );

    assert.equal(hint?.targetKey, ONBOARDING_TARGETS.NAV_CONFIGURACION);
  });

  it("highlights notifications action when panel is open", () => {
    const hint = resolveOnboardingCoachHint(
      guide("countries", 1),
      "/",
      new URLSearchParams(),
      null,
      true,
    );

    assert.equal(hint?.targetKey, ONBOARDING_TARGETS.NOTIFICATIONS_ACTION);
    assert.match(hint?.body ?? "", /Ir a Configuración/);
    assert.match(hint?.body ?? "", /panel de notificaciones/);
  });

  it("keeps the coach inside notifications for every open-panel step", () => {
    const hint = resolveOnboardingCoachHint(
      guide("pricing", 2, "Selecciona un país"),
      "/configuracion",
      new URLSearchParams("view=prices"),
      null,
      true,
    );

    assert.equal(hint?.targetKey, ONBOARDING_TARGETS.NOTIFICATIONS_ACTION);
    assert.match(hint?.body ?? "", /Ir a Configuración/);
  });

  it("highlights prices card on configuracion menu", () => {
    const hint = resolveOnboardingCoachHint(
      guide("countries", 2),
      "/configuracion",
      new URLSearchParams(),
    );

    assert.equal(hint?.targetKey, ONBOARDING_TARGETS.CONFIG_PRICES_CARD);
  });

  it("highlights return pricing from inventario during pricing step", () => {
    const hint = resolveOnboardingCoachHint(
      guide("pricing", 3),
      "/inventario",
      new URLSearchParams(
        "returnTo=%2Fconfiguracion%3Fview%3Dprices%26country%3DM%C3%A9xico",
      ),
    );

    assert.equal(hint?.targetKey, ONBOARDING_TARGETS.INVENTORY_RETURN_PRICING);
  });

  it("highlights both inventario entry points on pricing empty state", () => {
    const hint = resolveOnboardingCoachHint(
      guide("inventory", 1, "Abre Inventario"),
      "/configuracion",
      new URLSearchParams("view=prices&country=M%C3%A9xico"),
      {
        eligible: true,
        dismissed: false,
        started: true,
        steps: [],
        completedCount: 0,
        totalCount: 5,
        pendingCount: 5,
        allComplete: false,
        inventoryHasCategory: false,
        inventoryHasItems: false,
        firstCountryName: "México",
      },
    );

    assert.equal(hint?.targetKey, ONBOARDING_TARGETS.NAV_INVENTARIO);
    assert.deepEqual(hint?.extraTargetKeys, [ONBOARDING_TARGETS.CONFIG_GO_INVENTARIO]);
    assert.match(hint?.body ?? "", /Ir a Inventario/);
  });

  it("highlights nuevo remitente during first sale", () => {
    const hint = resolveOnboardingCoachHint(
      guide("first_sale", 2),
      "/venta",
      new URLSearchParams(),
    );

    assert.equal(hint?.targetKey, ONBOARDING_TARGETS.VENTA_NEW_SENDER);
  });

  it("anchors coach tooltips near the top edge of tall targets", () => {
    const anchor = {
      top: 100,
      left: 40,
      width: 600,
      height: 140,
    };

    const position = computeCoachTooltipPosition(anchor, 120, 1280, 800);

    assert.equal(position.top, 252);
    assert.ok(position.top < 320);
  });
});
