import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = join(process.cwd(), "src");
const appFrameSource = readFileSync(join(root, "components/app-frame.tsx"), "utf8");
const brandHeaderSource = readFileSync(
  join(root, "components/notifications/notifications-center.tsx"),
  "utf8",
);
const hydrationHookSource = readFileSync(join(root, "hooks/use-hydrated.ts"), "utf8");

describe("app shell hydration contract", () => {
  it("uses one SSR-safe hydration signal across the frame and brand header", () => {
    assert.match(appFrameSource, /import \{ useHydrated \} from "@\/hooks\/use-hydrated"/);
    assert.match(brandHeaderSource, /import \{ useHydrated \} from "@\/hooks\/use-hydrated"/);
    assert.match(hydrationHookSource, /useSyncExternalStore\(subscribe, getClientSnapshot, getServerSnapshot\)/);
    assert.match(hydrationHookSource, /function getServerSnapshot\(\) \{\s*return false;/);
  });

  it("defers pathname-derived context navigation until hydration is complete", () => {
    assert.match(
      appFrameSource,
      /config\.contextNavLabel \?\? \(isHydrated \? defaultContextNav\?\.contextNavLabel : undefined\)/,
    );
    assert.match(
      appFrameSource,
      /config\.onContextNavBack \?\? \(isHydrated \? defaultContextNav\?\.onContextNavBack : undefined\)/,
    );
    assert.match(
      appFrameSource,
      /const reserveDefaultContextNav =\s*!isHydrated && !config\.onContextNavBack && Boolean\(defaultContextNav\?\.onContextNavBack\)/,
    );
    assert.match(appFrameSource, /reserveContextNav=\{reserveDefaultContextNav\}/);
  });

  it("keeps the brand wordmark as the stable initial header tree", () => {
    assert.match(brandHeaderSource, /const showContextualTitle =\s*isHydrated && onBack/);
    assert.match(brandHeaderSource, /\{isHydrated && showContextBack \? \(/);
    assert.match(brandHeaderSource, /const showReservedBack = !showContextBack && reserveBackSlot && !keepBrand/);
    assert.match(
      brandHeaderSource,
      /<Link[\s\S]*?aria-label="Ir al inicio"[\s\S]*?<h1 className=\{`min-w-0 flex-1 \$\{titleClass\}`\}>\{brandTitle\}<\/h1>/,
    );
  });
});
