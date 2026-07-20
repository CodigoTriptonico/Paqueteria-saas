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
  it("aligns brand title and notifications on one horizontal row", () => {
    assert.match(source, /flex w-full min-w-0 items-center justify-between/);
    assert.match(source, /variant="brand"/);
    assert.match(source, /<h1 className=\{titleClass\}>\{brandTitle\}<\/h1>/);
  });

  it("keeps the Boxario mark as the home link even with contextual navigation", () => {
    assert.match(source, /import Link from "next\/link"/);
    assert.match(source, /<Link href="\/" prefetch aria-label="Ir al inicio"/);
    assert.match(source, /<h1 className=\{titleClass\}>\{brandTitle\}<\/h1>/);
    assert.match(source, /onBack && keepBrand/);
    assert.match(source, /min-h-\[4\.75rem\] flex-col/);
    assert.match(source, /<div className="mt-1 h-8 w-full" aria-hidden \/>/);
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
    assert.match(source, /\{isHydrated && onBack && !keepBrand \? \([\s\S]*onClick=\{onBack\}/);
    assert.match(source, /\{isHydrated && onBack && keepBrand \? \([\s\S]*onClick=\{onBack\}/);
    assert.doesNotMatch(source, /sidebarToggle/);
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
