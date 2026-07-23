import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BoxarioBrandHeader } from "@/components/notifications/notifications-center";

const source = readFileSync(
  join(process.cwd(), "src", "components", "notifications", "notifications-center.tsx"),
  "utf8",
);

describe("BoxarioBrandHeader layout", () => {
  it("keeps the brand and its actions in one compact row", () => {
    assert.match(source, /flex h-12 items-center overflow-visible/);
    assert.match(source, /inline-flex h-8 min-w-0 items-center rounded-lg/);
    assert.match(source, /ml-1 flex h-8 shrink-0 items-center gap-1/);
    assert.match(source, /variant="brand"/);
    assert.match(source, /<h1 className=\{`min-w-0 flex-1 \$\{titleClass\}`\}>\{brandTitle\}<\/h1>/);
    assert.match(source, /sidebarGroupsToggle \? \([\s\S]*ChevronsDownUp[\s\S]*\{showNotifications \? <NotificationsCenter/);
  });

  it("keeps the Boxario mark as the home link even with contextual navigation", () => {
    assert.match(source, /import Link from "next\/link"/);
    assert.match(source, /<Link[\s\S]*?href="\/"[\s\S]*?aria-label="Ir al inicio"/);
    assert.match(source, /<h1 className=\{`min-w-0 flex-1 \$\{titleClass\}`\}>\{brandTitle\}<\/h1>/);
    assert.match(source, /keepBrand = false/);
    assert.match(source, /reserveBackSlot\?: boolean/);
    assert.match(source, /const showContextBack = Boolean\(onBack\)/);
    assert.doesNotMatch(source, /h-\[5\.25rem\]/);
    assert.doesNotMatch(source, /<House className=/);
    assert.match(source, /\{onBack && !keepBrand && showContextualTitle \? \(/);
  });

  it("does not render the old cube mark in the brand header", () => {
    assert.doesNotMatch(source, /function BrandMark/);
    assert.doesNotMatch(source, /viewBox="0 0 32 32"/);
    assert.doesNotMatch(source, /<Package className=/);
  });

  it("uses a compact icon-only sidebar collapse control", () => {
    assert.match(source, /export function SidebarCollapseButton/);
    assert.match(source, /PanelLeftClose/);
    assert.match(source, /PanelLeftOpen/);
    assert.match(source, /Ocultar menú lateral/);
    assert.match(source, /Mostrar menú lateral/);
    assert.doesNotMatch(source, /Ocultar panel/);
  });

  it("keeps context back navigation separate from sidebar collapse", () => {
    assert.match(source, /\{isHydrated && showContextBack \? \([\s\S]*onClick=\{onBack\}/);
    assert.doesNotMatch(source, /sidebarToggle/);
  });

  it("keeps back navigation inline without creating an empty second row", () => {
    assert.match(source, /const showContextBack = Boolean\(onBack\)/);
    assert.match(source, /isHydrated && showContextBack/);
    assert.match(source, /flex min-w-0 flex-1 items-center gap-1\.5/);
    assert.doesNotMatch(source, /bottomBackVisible/);
    assert.doesNotMatch(source, /mt-auto flex h-8/);
  });

  it("does not reserve vertical space when no contextual action exists", () => {
    assert.match(source, /flex h-12 items-center overflow-visible/);
    assert.match(source, /ml-1 flex h-8 shrink-0 items-center gap-1/);
    assert.doesNotMatch(source, /h-\[5\.25rem\]/);
    assert.doesNotMatch(source, /bottomBackVisible/);
  });

  it("does not clip brand title descenders with leading-none truncate", () => {
    assert.match(source, /textTruncateSafeClass/);
    assert.doesNotMatch(source, /truncate font-black tracking-tight leading-none/);
  });

  it("reserves the contextual back control before hydration so the brand does not move", () => {
    assert.match(source, /const showReservedBack = !showContextBack && reserveBackSlot && !keepBrand/);
    assert.match(source, /\) : showReservedBack \? \(/);
    assert.match(source, /<span className=\{backButtonClass\} aria-hidden>/);
  });

  it("keeps the server header identical to the first hydration render", () => {
    const serverHtml = renderToStaticMarkup(
      createElement(BoxarioBrandHeader, {
        session: null,
        onBack: () => {},
        title: "Seguimiento",
      }),
    );

    assert.match(serverHtml, /<a[^>]+aria-label="Ir al inicio"/);
    assert.match(serverHtml, /<h1[^>]*>Boxario<\/h1>/);
    assert.doesNotMatch(serverHtml, /Seguimiento/);
  });

  it("uses card-header surface instead of flat card fill", () => {
    assert.match(source, /bg-surface-card-header/);
    assert.match(source, /shadow-\[0_6px_18px_rgba\(0,0,0,0\.2\)\]/);
  });

  it("keeps notification button on an inset well for contrast against the header", () => {
    assert.match(source, /isBrand[\s\S]*bg-surface-inset/);
  });

  it("adds a sidebar groups expand-all toggle beside notifications", () => {
    assert.match(source, /sidebarGroupsToggle\?: \{/);
    assert.match(source, /ChevronsDownUp/);
    assert.match(source, /Expandir todos los grupos del menú/);
    assert.match(source, /Contraer todos los grupos del menú/);
    assert.match(source, /onClick=\{sidebarGroupsToggle\.onToggle\}/);
  });
});
