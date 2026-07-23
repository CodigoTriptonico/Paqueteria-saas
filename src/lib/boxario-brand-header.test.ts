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
  it("gives the brand title its own top row and keeps actions on the lower row", () => {
    assert.match(source, /mt-auto flex h-8 min-w-0 items-center gap-1/);
    assert.match(source, /variant="brand"/);
    assert.match(source, /<h1 className=\{`min-w-0 flex-1 \$\{titleClass\}`\}>\{brandTitle\}<\/h1>/);
    assert.match(source, /sidebarGroupsToggle \? \([\s\S]*ChevronsDownUp[\s\S]*\{showNotifications \? <NotificationsCenter/);
  });

  it("keeps the Boxario mark as the home link even with contextual navigation", () => {
    assert.match(source, /import Link from "next\/link"/);
    assert.match(source, /<Link[\s\S]*?href="\/"[\s\S]*?aria-label="Ir al inicio"/);
    assert.match(source, /<h1 className=\{`min-w-0 flex-1 \$\{titleClass\}`\}>\{brandTitle\}<\/h1>/);
    assert.match(source, /onBack && keepBrand/);
    assert.match(source, /reserveBackSlot\?: boolean/);
    assert.match(source, /flex h-\[5\.25rem\] flex-col/);
    assert.doesNotMatch(source, /row-span-2/);
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
    assert.match(source, /showBottomBack \? \([\s\S]*onClick=\{onBack\}/);
    assert.doesNotMatch(source, /sidebarToggle/);
  });

  it("uses the reserved lower row for back navigation and header actions", () => {
    assert.match(source, /const showBottomBack = Boolean\(onBack && keepBrand\)/);
    assert.match(source, /mt-auto flex h-8 min-w-0 items-center gap-1/);
    assert.match(source, /bottomBackVisible \? "visible" : "invisible"/);
    assert.match(source, /flex h-8 min-w-0 flex-1 items-center gap-1\.5/);
    assert.match(source, /<span className="min-w-0 truncate">\{title\}<\/span>/);
    assert.match(source, /<div className="min-w-0 flex-1" aria-hidden \/>/);
  });

  it("pins the brand to the top row and keeps permanent space for the action buttons below", () => {
    assert.match(source, /flex h-\[5\.25rem\] flex-col/);
    assert.match(source, /mt-auto flex h-8 min-w-0 items-center gap-1/);
    assert.doesNotMatch(source, /row-span-2/);
    assert.doesNotMatch(source, /grid-rows-\[2rem_2rem\]/);
    assert.match(source, /bottomBackVisible \? "visible" : "invisible"/);
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
