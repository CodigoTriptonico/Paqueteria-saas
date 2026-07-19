import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const featureSource = readFileSync(join(root, "lib/onboarding/feature.ts"), "utf8");
const onboardingActionSource = readFileSync(join(root, "app/actions/onboarding.ts"), "utf8");
const onboardingPanelSource = readFileSync(
  join(root, "components/onboarding/onboarding-panel.tsx"),
  "utf8",
);
const microStepsSource = readFileSync(join(root, "lib/onboarding/micro-steps.ts"), "utf8");
const coachTargetsSource = readFileSync(join(root, "lib/onboarding/coach-targets.ts"), "utf8");
const coachOverlaySource = readFileSync(
  join(root, "components/onboarding/onboarding-coach-overlay.tsx"),
  "utf8",
);
const coachCountdownSource = readFileSync(
  join(root, "components/onboarding/onboarding-coach-countdown.tsx"),
  "utf8",
);
const appFrameSource = readFileSync(join(root, "components/app-frame.tsx"), "utf8");
const appShellSource = readFileSync(join(root, "components/app-shell.tsx"), "utf8");
const onboardingHelpSource = readFileSync(
  join(root, "components/onboarding/onboarding-help.ts"),
  "utf8",
);
const notificationsSource = readFileSync(
  join(root, "components/notifications/notifications-center.tsx"),
  "utf8",
);
const progressHookSource = readFileSync(join(root, "hooks/use-onboarding-progress.ts"), "utf8");

describe("onboarding tutorial eval", () => {
  it("defines a central feature flag", () => {
    assert.match(featureSource, /ONBOARDING_TUTORIAL_ENABLED = (true|false)/);
    assert.match(featureSource, /isOnboardingTutorialEnabled/);
  });

  it("loads onboarding progress from the server when enabled", () => {
    assert.match(onboardingActionSource, /isOnboardingTutorialEnabled\(\)/);
    assert.match(onboardingActionSource, /onboardingTutorialDisabledProgress\(\)/);
    assert.match(onboardingActionSource, /configPricesCountryHref/);
  });

  it("does not mark the first sale complete when only customers exist", () => {
    assert.match(onboardingActionSource, /const hasFirstSale = \(shipmentsResult\.count \|\| 0\) > 0/);
    assert.doesNotMatch(onboardingActionSource, /shipmentsResult\.count[\s\S]*customersResult\.count/);
  });

  it("requires a real inventory item instead of a non-empty category structure", () => {
    assert.match(onboardingActionSource, /const hasInventoryItems = \(inventoryItemsResult\.count \|\| 0\) > 0/);
    assert.doesNotMatch(onboardingActionSource, /treeDataHasItems/);
  });

  it("orders setup from catalog to countries, pricing, stock, and sale", () => {
    const inventoryIndex = onboardingActionSource.indexOf('id: "inventory"');
    const countriesIndex = onboardingActionSource.indexOf('id: "countries"');
    const pricingIndex = onboardingActionSource.indexOf('id: "pricing"');
    const stockIndex = onboardingActionSource.indexOf('id: "stock"');
    const saleIndex = onboardingActionSource.indexOf('id: "first_sale"');

    assert.ok(inventoryIndex < countriesIndex);
    assert.ok(countriesIndex < pricingIndex);
    assert.ok(pricingIndex < stockIndex);
    assert.ok(stockIndex < saleIndex);
  });

  it("shows the onboarding panel when enabled", () => {
    assert.match(onboardingPanelSource, /isOnboardingTutorialEnabled\(\)/);
    assert.match(onboardingPanelSource, /OnboardingPanel/);
  });

  it("guides inventory with compact structure and item actions", () => {
    assert.match(microStepsSource, /icono de estructura/);
    assert.match(microStepsSource, /pulsa Agregar/);
    assert.match(microStepsSource, /inventarioHrefWithReturn/);
  });

  it("mentions return to pricing from inventario", () => {
    assert.match(microStepsSource, /Volver a precios/);
    assert.match(onboardingHelpSource, /Nueva venta/);
  });

  it("provides idle coach hints for tutorial targets", () => {
    assert.match(coachTargetsSource, /ONBOARDING_COACH_IDLE_MS = 12_000/);
    assert.match(coachTargetsSource, /resolveOnboardingCoachHint/);
    assert.match(coachOverlaySource, /OnboardingCoachOverlay/);
    assert.match(coachOverlaySource, /useOnboardingCoachState/);
    assert.match(coachOverlaySource, /notificationsPanelOpen/);
    assert.match(coachCountdownSource, /OnboardingCoachSidebarCountdown/);
    assert.match(coachCountdownSource, /Próximo tip/);
    assert.match(appShellSource, /OnboardingCoachSidebarCountdown/);
    assert.match(appFrameSource, /OnboardingCoachProvider/);
    assert.match(appFrameSource, /OnboardingCoachOverlay/);
  });

  it("starts tutorial paused with a single start prompt", () => {
    const startPanelSource = readFileSync(
      join(root, "components/onboarding/onboarding-start-panel.tsx"),
      "utf8",
    );

    assert.match(startPanelSource, /Iniciar tutorial/);
    assert.match(onboardingActionSource, /onboarding_started/);
    assert.match(onboardingActionSource, /started: boolean/);
    assert.match(progressHookSource, /if \(!effectiveProgress\.started\)/);
  });

  it("renders onboarding inside notifications", () => {
    assert.match(notificationsSource, /OnboardingPanel/);
    assert.match(notificationsSource, /Configuración inicial en curso/);
  });

  it("fetches onboarding progress through the hook", () => {
    assert.match(progressHookSource, /isOnboardingTutorialEnabled\(\)/);
    assert.match(progressHookSource, /getOnboardingProgressAction/);
  });
});
